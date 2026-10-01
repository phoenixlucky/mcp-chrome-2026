// IndexedDB storage for element markers (URL -> marked selectors)
// Uses the shared IndexedDbClient for robust transaction handling.

import { IndexedDbClient } from '@/utils/indexeddb-client';
import type {
  ElementMarker,
  ElementMarkerFrameSegment,
  ElementMarkerMember,
  UpsertMarkerRequest,
} from '@/common/element-marker-types';

const DB_NAME = 'element_marker_storage';
const DB_VERSION = 1;
const STORE = 'markers';

const idb = new IndexedDbClient(DB_NAME, DB_VERSION, (db, oldVersion) => {
  switch (oldVersion) {
    case 0: {
      const store = db.createObjectStore(STORE, { keyPath: 'id' });
      // Useful indexes for lookups
      store.createIndex('by_host', 'host', { unique: false });
      store.createIndex('by_origin', 'origin', { unique: false });
      store.createIndex('by_path', 'path', { unique: false });
    }
  }
});

function normalizeUrl(raw: string): { url: string; origin: string; host: string; path: string } {
  try {
    const u = new URL(raw);
    return { url: raw, origin: u.origin, host: u.hostname, path: u.pathname };
  } catch {
    return { url: raw, origin: '', host: '', path: '' };
  }
}

function now(): number {
  return Date.now();
}

function normalizeFramePath(value: unknown): ElementMarkerFrameSegment[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 10) {
    throw new Error('framePath must contain no more than 10 iframe entries');
  }
  return value.map((segment, index) => {
    const selector = String(segment?.selector || '').trim();
    if (!selector || selector.length > 2000) {
      throw new Error(`framePath entry ${index + 1} requires a valid iframe selector`);
    }
    const url = typeof segment?.url === 'string' ? segment.url.slice(0, 4000) : undefined;
    return { selector, ...(url ? { url } : {}) };
  });
}

function normalizeMembers(value: unknown): ElementMarkerMember[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error('members must contain between 1 and 100 locators');
  }
  const ids = new Set<string>();
  return value.map((member, index) => {
    const id = String(member?.id || '').trim();
    const name = String(member?.name || '').trim();
    const selector = String(member?.selector || '').trim();
    const selectorType = member?.selectorType === 'xpath' ? 'xpath' : 'css';
    if (!id || ids.has(id)) throw new Error(`member ${index + 1} has a missing or duplicate id`);
    if (!selector || selector.length > 4000) {
      throw new Error(`member ${index + 1} requires a valid selector`);
    }
    ids.add(id);
    const framePath = normalizeFramePath(member?.framePath);
    return {
      id,
      name: name.slice(0, 200) || selector,
      selector,
      selectorType,
      ...(framePath?.length ? { framePath } : {}),
      ...(typeof member?.tagName === 'string' ? { tagName: member.tagName.slice(0, 100) } : {}),
    };
  });
}

function normalizeTags(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('tags must be an array of strings');
  const tags = [...new Set(value.map((tag) => String(tag || '').trim()).filter(Boolean))];
  if (tags.some((tag) => tag.length > 50) || tags.length > 30) {
    throw new Error('tags are limited to 30 labels of 50 characters each');
  }
  return tags;
}

function normalizeGroupName(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const name = String(value || '').trim();
  if (name.length > 100) throw new Error('groupName cannot exceed 100 characters');
  return name || undefined;
}

export async function listAllMarkers(): Promise<ElementMarker[]> {
  return idb.getAll<ElementMarker>(STORE);
}

export async function getMarkerById(id: string): Promise<ElementMarker | undefined> {
  return idb.get<ElementMarker>(STORE, id);
}

export async function listMarkersForUrl(url: string): Promise<ElementMarker[]> {
  const { origin, path, host } = normalizeUrl(url);
  const all = await idb.getAll<ElementMarker>(STORE);
  // Simple matching policy:
  // - exact: origin + path must match exactly
  // - prefix: origin matches and marker.path is a prefix of current path
  // - host: host matches regardless of path
  return all.filter((m) => {
    if (!m) return false;
    if (m.matchType === 'exact') return m.origin === origin && m.path === path;
    if (m.matchType === 'host') return !!m.host && m.host === host;
    // default 'prefix'
    return m.origin === origin && (m.path ? path.startsWith(m.path) : true);
  });
}

export async function saveMarker(req: UpsertMarkerRequest): Promise<ElementMarker> {
  const members = normalizeMembers(req.members);
  const selector = String(req.selector || members?.[0]?.selector || '').trim();
  const { url: rawUrl } = req;
  if (!rawUrl || !selector) throw new Error('url and selector are required');
  const tags = normalizeTags(req.tags);
  const groupName = normalizeGroupName(req.groupName);
  const groupId = String(req.groupId || '').trim() || undefined;
  const { url, origin, host, path } = normalizeUrl(rawUrl);
  const ts = now();
  const marker: ElementMarker = {
    id: req.id || (globalThis.crypto?.randomUUID?.() ?? `${ts}_${Math.random()}`),
    url,
    origin,
    host,
    path,
    matchType: req.matchType || 'prefix',
    name: req.name || selector,
    selector,
    selectorType: req.selectorType || 'css',
    listMode: req.listMode || false,
    action: req.action || 'custom',
    ...(groupId ? { groupId } : {}),
    ...(groupName ? { groupName } : {}),
    ...(tags ? { tags } : {}),
    ...(members ? { members } : {}),
    createdAt: ts,
    updatedAt: ts,
  };
  await idb.put<ElementMarker>(STORE, marker);
  return marker;
}

export async function updateMarker(marker: ElementMarker): Promise<void> {
  const existing = await idb.get<ElementMarker>(STORE, marker.id);
  if (!existing) throw new Error('marker not found');

  // Preserve createdAt from existing record, only update updatedAt
  const members = normalizeMembers(marker.members);
  const tags = normalizeTags(marker.tags);
  const groupName = normalizeGroupName(marker.groupName);
  const hasGroupName = Object.prototype.hasOwnProperty.call(marker, 'groupName');
  const updated: ElementMarker = {
    ...marker,
    ...(members ? { members, selector: marker.selector || members[0].selector } : {}),
    ...(tags ? { tags } : {}),
    ...(hasGroupName ? { groupName } : {}),
    createdAt: existing.createdAt, // Never overwrite createdAt
    updatedAt: now(),
  };
  await idb.put<ElementMarker>(STORE, updated);
}

export async function updateMarkerMember(
  markerId: string,
  memberId: string,
  locator: Pick<ElementMarkerMember, 'selector' | 'selectorType' | 'framePath' | 'tagName'>,
): Promise<ElementMarker> {
  const marker = await getMarkerById(markerId);
  if (!marker) throw new Error('marker not found');
  const selector = String(locator.selector || '').trim();
  if (!selector) throw new Error('selector is required');

  if (Array.isArray(marker.members) && marker.members.length) {
    const index = marker.members.findIndex((member) => member.id === memberId);
    if (index < 0) throw new Error('marker member not found');
    const members = marker.members.slice();
    members[index] = {
      ...members[index],
      selector,
      selectorType: locator.selectorType === 'xpath' ? 'xpath' : 'css',
      ...(locator.framePath?.length
        ? { framePath: normalizeFramePath(locator.framePath) }
        : { framePath: undefined }),
      ...(locator.tagName ? { tagName: locator.tagName.slice(0, 100) } : { tagName: undefined }),
    };
    const updated = { ...marker, members, updatedAt: now() };
    if (index === 0) {
      updated.selector = selector;
      updated.selectorType = members[index].selectorType;
    }
    await idb.put<ElementMarker>(STORE, updated);
    return updated;
  }

  if (memberId && memberId !== marker.id) throw new Error('marker member not found');
  const selectorType: ElementMarkerMember['selectorType'] =
    locator.selectorType === 'xpath' ? 'xpath' : 'css';
  const updated = {
    ...marker,
    selector,
    selectorType,
    ...(locator.framePath?.length
      ? { members: normalizeMembers([{ id: marker.id, name: marker.name, ...locator }]) }
      : {}),
    updatedAt: now(),
  };
  await idb.put<ElementMarker>(STORE, updated);
  return updated;
}

export async function updateGroupMetadata(
  groupId: string,
  metadata: { groupName?: string; tags?: string[] },
): Promise<number> {
  if (!groupId) throw new Error('groupId is required');
  const groupName = normalizeGroupName(metadata.groupName);
  const hasGroupName = Object.prototype.hasOwnProperty.call(metadata, 'groupName');
  const tags = normalizeTags(metadata.tags);
  const markers = await idb.getAll<ElementMarker>(STORE);
  const group = markers.filter((marker) => marker.groupId === groupId);
  await Promise.all(
    group.map((marker) =>
      idb.put<ElementMarker>(STORE, {
        ...marker,
        ...(hasGroupName ? { groupName } : {}),
        ...(tags !== undefined ? { tags } : {}),
        updatedAt: now(),
      }),
    ),
  );
  return group.length;
}

export async function deleteMarker(id: string): Promise<void> {
  await idb.delete(STORE, id);
}
