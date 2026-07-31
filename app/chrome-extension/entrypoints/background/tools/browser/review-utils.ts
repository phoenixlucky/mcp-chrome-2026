export type Field = {
  name: string;
  selector?: string;
  type?: 'text' | 'html' | 'outerHtml' | 'attribute' | 'number' | 'href' | 'src';
  attribute?: string;
};

export function extractRecordsFromDom(
  root: ParentNode,
  cardSelector: string,
  fields: Field[],
  excludeIfTextMatches: string[] = [],
  includeOuterHtml = false,
): { records: Record<string, unknown>[]; excludedCount: number } {
  let excludedCount = 0;
  const records = Array.from(root.querySelectorAll(cardSelector)).flatMap((card) => {
    const text = (card.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (excludeIfTextMatches.some((marker) => text.includes(marker.toLowerCase()))) {
      excludedCount += 1;
      return [];
    }
    const record: Record<string, unknown> = {};
    for (const field of fields) {
      const element = field.selector ? card.querySelector(field.selector) : card;
      if (!element) {
        record[field.name] = null;
        continue;
      }
      const type = field.type || 'text';
      if (type === 'html') record[field.name] = element.innerHTML;
      else if (type === 'outerHtml') record[field.name] = element.outerHTML;
      else if (type === 'attribute')
        record[field.name] = field.attribute ? element.getAttribute(field.attribute) : null;
      else if (type === 'number') {
        const value = Number.parseFloat((element.textContent || '').replace(/[^\d.-]/g, ''));
        record[field.name] = Number.isFinite(value) ? value : null;
      } else if (type === 'href')
        record[field.name] = (element as HTMLAnchorElement).href || element.getAttribute('href');
      else if (type === 'src')
        record[field.name] = (element as HTMLImageElement).src || element.getAttribute('src');
      else record[field.name] = (element.textContent || '').replace(/\s+/g, ' ').trim();
    }
    if (includeOuterHtml) record.outerHtml = card.outerHTML;
    return [record];
  });
  return { records, excludedCount };
}

export function detectEmptyStateFromDom(
  root: ParentNode,
  contentSelector: string,
  emptyTextMarkers: string[] = [],
  countSelector?: string,
) {
  const contentCount = root.querySelectorAll(contentSelector).length;
  const text = (root.textContent || '').toLowerCase();
  const matchedMarker = emptyTextMarkers.find((marker) => text.includes(marker.toLowerCase()));
  const countText = countSelector
    ? root.querySelector(countSelector)?.textContent?.trim() || null
    : null;
  return {
    state:
      contentCount > 0
        ? 'has_content'
        : matchedMarker || countText === '0'
          ? 'empty'
          : 'loading_or_unknown',
    contentCount,
    matchedMarker: matchedMarker || null,
    countText,
  };
}

export function hashCards(root: ParentNode, cardSelector: string): string {
  let hash = 2166136261;
  for (const card of Array.from(root.querySelectorAll(cardSelector))) {
    for (const char of card.outerHTML) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function mergeRecords(
  sources: Array<{ name: string; priority: number; records: Record<string, unknown>[] }>,
  identityFields: string[],
  fieldPriority: Record<string, string[]> = {},
  allowSourceOnlyRecords = true,
  textNormalize = true,
  dateToleranceDays = 0,
) {
  const grouped = new Map<
    string,
    Array<{ source: string; priority: number; record: Record<string, unknown> }>
  >();
  const normalized = (value: unknown) =>
    textNormalize
      ? String(value ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase()
      : String(value ?? '');
  const equivalentKey = (record: Record<string, unknown>) => {
    const identity = identityFields.map((field) => normalized(record[field]));
    for (const [key, records] of grouped) {
      const sample = records[0]?.record;
      const same = identityFields.every((field, index) => {
        const left = identity[index];
        const right = normalized(sample?.[field]);
        if (left === right) return true;
        const a = Date.parse(left);
        const b = Date.parse(right);
        return (
          Number.isFinite(a) &&
          Number.isFinite(b) &&
          Math.abs(a - b) <= dateToleranceDays * 86_400_000
        );
      });
      if (same) return key;
    }
    return identity.join('\\u0001');
  };
  for (const source of sources)
    for (const record of source.records) {
      const key = identityFields
        .map((field) =>
          String(record[field] ?? '')
            .trim()
            .toLowerCase(),
        )
        .join('\u0001');
      const groupKey = equivalentKey(record) || key;
      grouped.set(groupKey, [
        ...(grouped.get(groupKey) || []),
        { source: source.name, priority: source.priority, record },
      ]);
    }
  let droppedSourceOnlyCount = 0;
  const records = Array.from(grouped.values()).flatMap((group) => {
    if (!allowSourceOnlyRecords && group.length === 1) {
      droppedSourceOnlyCount += 1;
      return [];
    }
    const output: Record<string, unknown> = {};
    const fields = new Set(group.flatMap(({ record }) => Object.keys(record)));
    for (const field of fields) {
      const preferred = fieldPriority[field] || [];
      const selected = [...group]
        .sort((a, b) => {
          const aRank = preferred.indexOf(a.source);
          const bRank = preferred.indexOf(b.source);
          return (aRank < 0 ? 999 : aRank) - (bRank < 0 ? 999 : bRank) || a.priority - b.priority;
        })
        .find(
          ({ record }) =>
            record[field] !== null && record[field] !== undefined && record[field] !== '',
        );
      output[field] = selected?.record[field] ?? null;
    }
    return [output];
  });
  return { records, matchedCount: records.length, droppedSourceOnlyCount };
}
