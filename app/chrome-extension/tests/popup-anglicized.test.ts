import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';

import PopupApp from '../entrypoints/popup/App.vue';
import ConfirmDialog from '../entrypoints/popup/components/ConfirmDialog.vue';
import ElementMarkerManagement from '../entrypoints/popup/components/ElementMarkerManagement.vue';
import LocalModelPage from '../entrypoints/popup/components/LocalModelPage.vue';
import McpToolsPage from '../entrypoints/popup/components/McpToolsPage.vue';
import ScheduleDialog from '../entrypoints/popup/components/ScheduleDialog.vue';

const popupRoot = resolve(__dirname, '../entrypoints/popup');
const readPopup = (path: string) => readFileSync(resolve(popupRoot, path), 'utf8');

/** Remove a `start ... end` region (both markers included) from `source`. */
const stripRegion = (source: string, start: string, end: string) => {
  const from = source.indexOf(start);
  if (from === -1) return source;
  const to = source.indexOf(end, from);
  return source.slice(0, from) + source.slice(to === -1 ? source.length : to + end.length);
};

/**
 * The popup keeps a few intentionally bilingual spots: the MCP tools page's zh
 * catalogs and locale chip, plus the legacy 页面录制/录制自 literals the
 * recent-recordings filter must keep matching.
 */
const allowed = (file: string, source: string) => {
  let text = source;
  if (file.endsWith('McpToolsPage.vue')) {
    text = stripRegion(text, 'const messages = {', '} as const;');
    text = stripRegion(text, 'const zhDescriptions:', '};');
    text = stripRegion(text, 'const zhToolParameterDescriptions:', '};');
    text = stripRegion(text, 'const zhParameterDescriptions:', '};');
    text = stripRegion(text, 'const categoryLabels = {', '} as const;');
    text = text.replace(/中文/g, '');
    text = text.replace(/.*zh \?.*\n/g, ''); // inline zh ternary labels
  }
  if (file.endsWith('App.vue')) {
    text = text.replace(/页面录制/g, '').replace(/录制自 /g, '');
  }
  return text;
};

const popupFiles = [
  'App.vue',
  'index.html',
  'main.ts',
  'style.css',
  'components/McpToolsPage.vue',
  'components/ScheduleDialog.vue',
  'components/LocalModelPage.vue',
  'components/ElementMarkerManagement.vue',
  'components/ConfirmDialog.vue',
  'components/ProgressIndicator.vue',
];

describe('popup slice is anglicized', () => {
  it.each(popupFiles)('%s keeps no Chinese outside the allowed bilingual spots', (file) => {
    const leftovers = (allowed(file, readPopup(file)).match(/[\u4e00-\u9fff]+/g) || []).slice(0, 8);
    expect(leftovers).toEqual([]);
  });

  it('home screen uses the Catgirl brand and English tool labels', () => {
    const app = readPopup('App.vue');
    expect(app).toContain('Catgirl Chrome MCP Server');
    expect(app).toContain('title="Open welcome page"');
    expect(app).toContain('>Run</button>');
    expect(readPopup('index.html')).toContain('<title>Catgirl Chrome MCP</title>');
  });

  it('recent recordings filter accepts new and legacy flow metadata', () => {
    const app = readPopup('App.vue');
    expect(app).toContain("flow.meta?.tags?.includes('Page recording')");
    expect(app).toContain("flow.meta?.tags?.includes('页面录制')");
    expect(app).toContain("flow.description?.startsWith('Recorded from ')");
    expect(app).toContain("flow.description?.startsWith('录制自 ')");
    expect(app).toContain('// legacy flows recorded before the anglicization');
  });

  it('MCP tools page defaults to English and keeps the zh catalogs', () => {
    const page = readPopup('components/McpToolsPage.vue');
    expect(page).toContain("localStorage.getItem('mcp-tools-locale') === 'zh' ? 'zh' : 'en'");
    expect(page).toContain('const messages = {');
    expect(page).toContain('zhDescriptions');
    expect(page).toContain('zhToolDescriptions');
    expect(page).toContain('zhParameterDescriptions');
    expect(page).toContain('TOOL_SCHEMAS_ZH');
  });
});

/**
 * Runtime proof that the anglicized templates compile and render English by
 * default. The vitest config registers @vitejs/plugin-vue, so .vue imports are
 * compiled like in the real build.
 */
const cjkOnly = (html: string) => html.replace(/中文/g, '').match(/[\u4e00-\u9fff]/g) || [];

describe('popup renders English by default', () => {
  it('home screen', async () => {
    const html = await renderToString(createSSRApp(PopupApp));
    expect(html).toContain('Catgirl Chrome MCP Server');
    expect(html).toContain('Quick tools');
    expect(html).toContain('Page message timeout');
    expect(html).toContain('MCP service endpoint');
    expect(html).toContain('Streamable HTTP (compatible)');
    expect(cjkOnly(html)).toEqual([]); // only the zh/en locale chip keeps 中文
  });

  it('MCP tools page defaults to English and still supports zh', async () => {
    localStorage.removeItem('mcp-tools-locale');
    const html = await renderToString(createSSRApp(McpToolsPage));
    expect(html).toContain('MCP Tools');
    expect(html).toContain('Back to home');
    expect(html).toContain('Ease: ');
    expect(html).not.toContain('个工具');
    expect(cjkOnly(html)).toEqual([]);

    localStorage.setItem('mcp-tools-locale', 'zh');
    const zhHtml = await renderToString(createSSRApp(McpToolsPage));
    expect(zhHtml).toContain('MCP 工具一览');
    expect(zhHtml).toContain('个工具');
    // Tools absent from the page's inline zh maps fall back to the Chinese
    // catalog, not to the English canonical one.
    expect(zhHtml).toContain('管理隔离浏览器 Profile');
    expect(zhHtml).toContain('递归入口 URL 列表');
    localStorage.removeItem('mcp-tools-locale');
  });

  it('schedule dialog, marker page, local model page and confirm dialog', async () => {
    const schedHtml = await renderToString(
      createSSRApp(ScheduleDialog, { visible: true, flowId: 'f1', schedules: [] }),
    );
    expect(schedHtml).toContain('Scheduled run');
    expect(schedHtml).toContain('Every N minutes');
    expect(cjkOnly(schedHtml)).toEqual([]);

    const markerHtml = await renderToString(createSSRApp(ElementMarkerManagement));
    expect(markerHtml).toContain('Element marker management');
    expect(cjkOnly(markerHtml)).toEqual([]);

    const localHtml = await renderToString(
      createSSRApp(LocalModelPage, { semanticEngineStatus: 'idle' }),
    );
    expect(localHtml).toContain('Local models');
    expect(localHtml).toContain('Back to home');
    expect(cjkOnly(localHtml)).toEqual([]);

    const confirmHtml = await renderToString(
      createSSRApp(ConfirmDialog, { visible: true, title: 'T', message: 'M' }),
    );
    expect(cjkOnly(confirmHtml)).toEqual([]);
  });
});
