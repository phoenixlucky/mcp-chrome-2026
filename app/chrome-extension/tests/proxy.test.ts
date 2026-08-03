import { describe, expect, it } from 'vitest';
import {
  buildProxyUsername,
  createProxyPac,
  normalizeProxyConfig,
  shouldRotatePage,
} from '@/entrypoints/background/proxy';

describe('proxy config', () => {
  it('inserts or replaces an Oxylabs sticky session id', () => {
    expect(buildProxyUsername('customer-user-cc-us-sesstime-5', '0366')).toBe(
      'customer-user-cc-us-sessid-0366-sesstime-5',
    );
    expect(buildProxyUsername('customer-user-sessid-old-sesstime-5', '0366')).toBe(
      'customer-user-sessid-0366-sesstime-5',
    );
    expect(buildProxyUsername('customer-user-cc-us', '0366')).toBe(
      'customer-user-cc-us-sessid-0366',
    );
    expect(buildProxyUsername('customer-user-sessid-old', '0366', 'ca')).toBe(
      'customer-user-cc-ca-sessid-0366',
    );
  });

  it('accepts a complete proxy connection string', () => {
    expect(
      normalizeProxyConfig({
        enabled: true,
        host: 'customer-user-cc-us:secret@pr.oxylabs.io:7777',
      }),
    ).toMatchObject({
      host: 'pr.oxylabs.io',
      port: 7777,
      username: 'customer-user-cc-us',
      password: 'secret',
    });
  });

  it('accepts a host and port while keeping separately entered credentials', () => {
    expect(
      normalizeProxyConfig({
        enabled: true,
        host: 'pr.oxylabs.io:7777',
        username: 'customer-user-cc-us',
        password: 'secret',
      }),
    ).toMatchObject({ host: 'pr.oxylabs.io', port: 7777, username: 'customer-user-cc-us' });
  });

  it('rejects enabled proxy configs without usable connection details', () => {
    expect(() => normalizeProxyConfig({ enabled: true, host: 'proxy.example', port: 0 })).toThrow();
  });

  it('only rotates on retryable page statuses', () => {
    expect(shouldRotatePage(403)).toBe(true);
    expect(shouldRotatePage(429)).toBe(true);
    expect(shouldRotatePage(500)).toBe(true);
    expect(shouldRotatePage(404)).toBe(false);
  });

  it('uses the proxy only for configured domains in PAC mode', () => {
    const pac = createProxyPac(['example.com', '*.shop.test'], 'pr.oxylabs.io', 7777);
    expect(pac).toContain('PROXY pr.oxylabs.io:7777');
    expect(pac).toContain('api.ipify.org');
    expect(pac).toContain('dnsDomainIs(host, ".example.com")');
    expect(pac).toContain('return "DIRECT"');
  });
});
