import { describe, expect, it } from 'vitest';

import { sanitizeText } from '@/utils/output-sanitizer';

describe('output sanitizer query strings', () => {
  it('keeps ordinary text with spaced equals signs and ampersands', () => {
    expect(sanitizeText('prompt: face=unchanged & outfit=unchanged').redacted).toBe(false);
  });

  it('keeps ordinary text with semicolon-separated settings', () => {
    expect(sanitizeText('camera=close-up; lighting=soft; composition=portrait').redacted).toBe(
      false,
    );
  });

  it('does not treat prose containing "side" as a SID cookie', () => {
    expect(
      sanitizeText('prompt {"layout":"side by side"}; relationship=subject; note=done').redacted,
    ).toBe(false);
  });

  it('blocks contiguous query parameters', () => {
    expect(sanitizeText('https://example.com/?token=secret&session=value').text).toBe(
      '[BLOCKED: Cookie/query string data]',
    );
  });

  it('blocks cookies carrying a sensitive key', () => {
    expect(sanitizeText('session=secret; theme=dark').text).toBe(
      '[BLOCKED: Cookie/query string data]',
    );
    expect(sanitizeText('SID=secret; theme=dark').text).toBe('[BLOCKED: Cookie/query string data]');
  });
});
