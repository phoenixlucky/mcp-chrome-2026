import { describe, expect, it } from 'vitest';
import {
  buildProxyUsername,
  createProxyPac,
  getProxyScope,
  isClosedTabError,
  isFatalProxyNetworkError,
  isKnownPageError,
  normalizeProxyConfig,
  shouldRotateNetworkError,
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
    expect(buildProxyUsername('customer-user-sessid-old_id-sesstime-1440', 'new-id')).toBe(
      'customer-user-sessid-new-id-sesstime-1440',
    );
    expect(buildProxyUsername('customer-user-cc-us', '0366')).toBe(
      'customer-user-cc-us-sessid-0366-sesstime-5',
    );
    expect(buildProxyUsername('customer-user-sessid-old', '0366', 'ca')).toBe(
      'customer-user-cc-ca-sessid-0366-sesstime-5',
    );
    expect(buildProxyUsername('customer-user', '0366', 'mx')).toBe(
      'customer-user-cc-mx-sessid-0366-sesstime-5',
    );
    expect(buildProxyUsername('customer-user-cc-us', '', 'random')).toBe('customer-user');
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

  it('recognizes the known page-level error message', () => {
    expect(isKnownPageError('Oops!! Something went wrong. Please refresh page')).toBe(true);
    expect(isKnownPageError('Oops!!\nSomething went wrong.\nPlease refresh page')).toBe(true);
    expect(isKnownPageError('Something went wrong, but the page is usable')).toBe(false);
  });

  it('preserves the HTTPS protocol from a complete connection string', () => {
    expect(
      normalizeProxyConfig({
        enabled: true,
        host: 'https://customer-user:secret@us-pr.oxylabs.io:10001',
        endpointType: 'country',
        countryCode: 'us',
      }),
    ).toMatchObject({ protocol: 'https', host: 'us-pr.oxylabs.io', port: 10001 });
  });

  it('uses the country-specific Oxylabs entry node without cc parameters', () => {
    expect(
      normalizeProxyConfig({
        enabled: true,
        endpointType: 'country',
        countryCode: 'us',
        username: 'customer-user-cc-us',
        password: 'secret',
      }),
    ).toMatchObject({ host: 'us-pr.oxylabs.io', port: 10000, username: 'customer-user' });
  });

  it('supports Mexico and Brazil country-specific entry nodes', () => {
    expect(
      normalizeProxyConfig({
        enabled: true,
        endpointType: 'country',
        countryCode: 'mx',
        protocol: 'https',
        username: 'user',
        password: 'secret',
      }),
    ).toMatchObject({ host: 'mx-pr.oxylabs.io', port: 10001, username: 'customer-user' });
    expect(
      normalizeProxyConfig({
        enabled: true,
        endpointType: 'country',
        countryCode: 'br',
        username: 'user',
        password: 'secret',
      }),
    ).toMatchObject({ host: 'br-pr.oxylabs.io', port: 20000, username: 'customer-user' });
  });

  it('adds the Oxylabs customer prefix for a country-specific entry node', () => {
    expect(
      normalizeProxyConfig({
        enabled: true,
        endpointType: 'country',
        countryCode: 'us',
        username: 'user',
        password: 'secret',
      }),
    ).toMatchObject({ username: 'customer-user' });
  });

  it('uses the HTTPS port for a country-specific HTTPS entry node', () => {
    expect(
      normalizeProxyConfig({
        enabled: true,
        endpointType: 'country',
        countryCode: 'us',
        protocol: 'https',
        username: 'customer-user',
        password: 'secret',
      }),
    ).toMatchObject({ host: 'us-pr.oxylabs.io', port: 10001, protocol: 'https' });
  });

  it('uses the selected Oxylabs access region without changing username parameters', () => {
    expect(
      normalizeProxyConfig({
        enabled: true,
        accessRegion: 'beijing',
        username: 'customer-user-cc-us-sessid-1',
        password: 'secret',
      }),
    ).toMatchObject({
      host: 'cnt9t1is.com',
      port: 8000,
      protocol: 'https',
      username: 'customer-user-cc-us-sessid-1',
    });
  });

  it('groups subdomains into a stable site session scope', () => {
    expect(getProxyScope('https://www.lowes.com/store/123')).toBe('lowes.com');
    expect(getProxyScope('https://sub.homedepot.com/products')).toBe('homedepot.com');
    expect(getProxyScope('https://assets.example.com/app.js', ['*.example.com'])).toBe(
      'example.com',
    );
  });

  it('recognizes proxy connection failures that must stop the global proxy', () => {
    expect(isFatalProxyNetworkError('net::ERR_PROXY_CONNECTION_FAILED')).toBe(true);
    expect(isFatalProxyNetworkError('net::ERR_TUNNEL_CONNECTION_FAILED')).toBe(true);
    expect(isFatalProxyNetworkError('net::ERR_CONNECTION_TIMED_OUT')).toBe(false);
  });

  it('ignores generic network timeouts for automatic IP rotation', () => {
    expect(shouldRotateNetworkError('net::ERR_PROXY_CONNECTION_FAILED')).toBe(true);
    expect(shouldRotateNetworkError('net::ERR_TUNNEL_CONNECTION_FAILED')).toBe(true);
    expect(shouldRotateNetworkError('net::ERR_TIMED_OUT')).toBe(false);
    expect(shouldRotateNetworkError('net::ERR_CONNECTION_TIMED_OUT')).toBe(false);
  });

  it('treats a tab closed during automatic retry as harmless', () => {
    expect(isClosedTabError(new Error('No tab with id: 323090993.'))).toBe(true);
    expect(isClosedTabError(new Error('Proxy rejected connection'))).toBe(false);
  });

  it('uses the proxy only for configured domains in PAC mode', () => {
    const pac = createProxyPac(['example.com', '*.shop.test'], 'pr.oxylabs.io', 7777);
    expect(pac).toContain('PROXY pr.oxylabs.io:7777');
    expect(pac).toContain('ip.oxylabs.io');
    expect(pac).toContain('dnsDomainIs(host, ".example.com")');
    expect(pac).toContain('return "DIRECT"');
  });
});
