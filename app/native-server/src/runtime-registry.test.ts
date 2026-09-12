import { describe, expect, test } from '@jest/globals';
import { RuntimeRegistry } from './runtime-registry';

describe('RuntimeRegistry', () => {
  test('keeps only safe task and event summaries', () => {
    const registry = new RuntimeRegistry();
    registry.start({
      taskId: 'task-1',
      kind: 'mcp',
      label: 'chrome_click_element',
      toolName: 'chrome_click_element',
      origin: 'https://example.com/orders?id=secret',
    });

    registry.update('task-1', 'error', 'error', {
      errorMessage: 'failed at https://example.com/orders?id=secret',
    });

    const task = registry.get('task-1');
    expect(task?.summary.origin).toBe('https://example.com');
    expect(task?.summary.errorMessage).toContain('[URL]');
    expect(JSON.stringify(task)).not.toContain('secret');
  });

  test('cancel state is terminal and remains in history', () => {
    const registry = new RuntimeRegistry();
    registry.start({ taskId: 'task-2', kind: 'agent', label: 'Agent · claude' });
    registry.finish('task-2', 'cancelled');
    expect(registry.active()).toHaveLength(0);
    expect(registry.get('task-2')?.summary.status).toBe('cancelled');
    const events = registry.get('task-2')?.events ?? [];
    expect(events[events.length - 1]?.type).toBe('finished');
  });
});
