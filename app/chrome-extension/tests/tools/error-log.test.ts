import { describe, expect, it } from 'vitest';

import { formatErrorLogArguments } from '@/entrypoints/background/error-log';

describe('plugin error log', () => {
  it('keeps an error message and stack exportable', () => {
    const error = new Error('capture failed');
    expect(formatErrorLogArguments(['NetworkDebuggerStartTool:', error])).toMatchObject({
      message: 'NetworkDebuggerStartTool: capture failed',
      stack: error.stack,
    });
  });
});
