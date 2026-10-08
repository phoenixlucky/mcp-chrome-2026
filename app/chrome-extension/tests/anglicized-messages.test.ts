/**
 * Anglicized welcome / options tests
 * @description Pins the English surface produced for this slice: proxy config
 * validation, flow conversion errors, the welcome brand title (whose zh twin
 * keeps its Chinese value) and both SFC templates compiling with no stray CJK
 * beyond the language toggle.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { compileTemplate } from 'vue/compiler-sfc';

import { normalizeProxyConfig } from '../entrypoints/background/proxy';
import { builderFlowToV3 } from '../entrypoints/shared/utils/rr-flow-convert';
import { PAGE_TITLE, t } from '../entrypoints/welcome/locale';

// Template-source checks: compile the SFC templates directly so the assertions
// see exactly what ships, independent of the component's runtime setup.
function compileTemplateOf(file: string): string {
  const src = readFileSync(file, 'utf8');
  const template = src.slice(src.indexOf('<template>') + 10, src.lastIndexOf('</template>'));
  const { code, errors } = compileTemplate({ source: template, filename: file, id: 'x' });
  expect(errors).toEqual([]);
  return code;
}

// The CJK regex is cryptic enough to keep behind a name.
function cjkIn(text: string): string[] {
  return [...new Set(text.match(/[\u4e00-\u9fff]+/g) || [])];
}

describe('English error messages', () => {
  it('reports proxy validation errors in English', () => {
    expect(() =>
      normalizeProxyConfig({
        enabled: true,
        host: 'pr.oxylabs.io',
        username: '',
        password: 'b',
      }),
    ).toThrow('Enabling the proxy requires a username and password');
    expect(() =>
      normalizeProxyConfig({
        enabled: true,
        host: 'cnt9t1is.com',
        username: 'customer-x',
        password: 'p',
        accessRegion: 'custom',
        port: 0,
      }),
    ).toThrow('Proxy port must be between 1 and 65535');
    expect(() =>
      normalizeProxyConfig({
        enabled: true,
        host: 'proxy.example/path',
        username: 'a',
        password: 'b',
        accessRegion: 'custom',
      }),
    ).toThrow('Proxy host must be a domain or IP without protocol or port');
    expect(() =>
      normalizeProxyConfig({
        enabled: true,
        host: 'pr.oxylabs.io',
        username: 'customer-x',
        password: 'p',
        protocol: 'socks5',
      }),
    ).toThrow('Oxylabs SOCKS5 is not supported by Chrome; choose HTTP or HTTPS');
  });

  it('reports a flow conversion error in English', () => {
    expect(() =>
      builderFlowToV3({
        id: 'f',
        name: 'n',
        version: 3,
        nodes: [{ id: 't', type: 'trigger' }],
        edges: [],
      }),
    ).toThrow('A workflow requires at least one executable node');
  });

  it('keeps the welcome brand title English for en and Chinese for zh', () => {
    expect(PAGE_TITLE.en).toBe('Catgirl Chrome MCP Server');
    expect(PAGE_TITLE.zh).toBe('猫娘 Chrome MCP Server');
    expect(t('openDocs', 'en')).toBe('Open troubleshooting docs');
  });
});

describe('Anglicized SFC templates', () => {
  it('welcome keeps only the language-toggle CJK and shows the English brand', () => {
    const code = compileTemplateOf('entrypoints/welcome/App.vue');
    expect(code).toContain('Catgirl Chrome MCP Server');
    expect(cjkIn(code).every((hit) => ['语言', '中文'].includes(hit))).toBe(true);
  });

  it('options template has no CJK left', () => {
    const code = compileTemplateOf('entrypoints/options/App.vue');
    expect(cjkIn(code)).toEqual([]);
    expect(code).toContain('Residential proxy');
    expect(code).toContain('Save proxy settings');
  });
});
