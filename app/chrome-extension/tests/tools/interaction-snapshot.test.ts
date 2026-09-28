import { describe, expect, it } from 'vitest';
import {
  clickTool,
  fillTool,
  resolveActionSnapshotRef,
} from '../../entrypoints/background/tools/browser/interaction';
import {
  frameScopedActionRef,
  serializeActionSnapshot,
} from '../../entrypoints/background/tools/browser/action-snapshot';

describe('snapshot-scoped interactions', () => {
  it('requires the frame-scoped ref and matching frameId for snapshot-scoped actions', async () => {
    const click = await clickTool.execute({
      ref: 'ref_1',
      snapshotId: 'snapshot-1',
    });
    const fill = await fillTool.execute({
      ref: 'ref_1',
      snapshotId: 'snapshot-1',
      value: 'value',
    });

    expect(click.isError).toBe(true);
    expect(JSON.stringify(click)).toContain('frame-scoped ref');
    expect(fill.isError).toBe(true);
    expect(JSON.stringify(fill)).toContain('frame-scoped ref');
  });

  it('rejects a snapshot ref when its encoded frame does not match frameId', async () => {
    const click = await clickTool.execute({
      ref: 'frame:7:ref_1',
      frameId: 0,
      snapshotId: 'snapshot-1',
    });
    const fill = await fillTool.execute({
      ref: 'frame:7:ref_1',
      frameId: 0,
      snapshotId: 'snapshot-1',
      value: 'value',
    });

    expect(click.isError).toBe(true);
    expect(JSON.stringify(click)).toContain('frameId must match');
    expect(fill.isError).toBe(true);
    expect(JSON.stringify(fill)).toContain('frameId must match');
  });

  it('builds frame-scoped refs and decodes them only for the matching frame', () => {
    const ref = frameScopedActionRef(7, 'ref_1');
    expect(ref).toBe('frame:7:ref_1');
    expect(resolveActionSnapshotRef(ref, 7, 'snapshot-1')).toEqual({ ref: 'ref_1' });
    expect(resolveActionSnapshotRef(ref, 0, 'snapshot-1').error).toContain('frameId must match');
    expect(resolveActionSnapshotRef('ref_1', 7, 'snapshot-1').error).toContain('frame-scoped ref');
  });

  it('keeps action snapshot JSON within the UTF-8 byte budget', () => {
    const text = '漢"\\\n'.repeat(6_000);
    const encoded = serializeActionSnapshot({
      success: true,
      snapshotId: 'snapshot-1',
      tabId: 1,
      url: 'https://example.test/',
      title: 'Page',
      text,
      viewport: { width: 1000, height: 800 },
      createdAt: Date.now(),
      expiresInMs: 30_000,
      controls: [{ ref: 'frame:0:ref_1', name: 'A'.repeat(20_000) }],
      truncated: false,
      stats: { frames: 1, controls: 1 },
    });

    expect(new TextEncoder().encode(encoded).byteLength).toBeLessThanOrEqual(24_000);
    expect(JSON.parse(encoded).truncated).toBe(true);
  });
});
