import { describe, expect, it } from 'vitest';
import { extractJsonRecords } from '@/entrypoints/background/tools/browser/collector-utils';

describe('extractJsonRecords', () => {
  it('extracts wildcard records and relative fields without site rules', () => {
    expect(
      extractJsonRecords(
        {
          data: {
            items: [
              { id: '1', text: 'one' },
              { id: '2', text: 'two' },
            ],
          },
        },
        '$..items[*]',
        { id: '$.id', text: '$.text' },
      ),
    ).toEqual([
      { id: '1', text: 'one' },
      { id: '2', text: 'two' },
    ]);
  });
});
