/**
 * Welcome page i18n
 *
 * zh / en switching for the welcome page. The choice is persisted in
 * localStorage (`LOCALE_STORAGE_KEY`) and defaults to the browser language.
 * `applyLocale` keeps the document <html lang> and <title> in sync.
 */

export type Locale = 'zh' | 'en';

export const LOCALE_STORAGE_KEY = 'welcome-page-locale';

export const PAGE_TITLE: Record<Locale, string> = {
  zh: '猫娘 Chrome MCP Server',
  en: 'Catgirl Chrome MCP Server',
};

const COPY = {
  subtitle: {
    zh: '安装扩展后，这是唯一需要的一步。',
    en: 'After the extension is installed, this is the only required step.',
  },
  troubleshooting: { zh: '故障排查文档', en: 'Troubleshooting Docs' },
  installTitle: { zh: '安装', en: 'Install' },
  installDesc: {
    zh: 'Chrome 扩展通过这个本地桥接程序向你的 MCP 客户端暴露浏览器工具。',
    en: 'The Chrome extension uses this local bridge to expose MCP tools to your client.',
  },
  npmInstallTip: {
    zh: '上面的 npm 命令会自动允许桥接器和 better-sqlite3 执行本次安装脚本。',
    en: 'The npm command above automatically allows the bridge and better-sqlite3 to run scripts for this install.',
  },
  copied: { zh: '已复制', en: 'Copied' },
  copy: { zh: '复制', en: 'Copy' },
  nodeVersionTipPre: {
    zh: '需要 Node.js 20 及以上版本，可用 ',
    en: 'Requires Node.js 20+. Check your version with ',
  },
  nodeVersionTipPost: { zh: ' 检查版本。', en: '.' },
  mcpUrlTitle: { zh: 'MCP 客户端 URL（streamable HTTP）', en: 'MCP client URL (streamable HTTP)' },
  mcpUrlDesc: {
    zh: '在你的 MCP 客户端（如 Claude Desktop、CherryStudio）中使用此 URL。',
    en: 'Use this URL in your MCP client (e.g., Claude Desktop, CherryStudio).',
  },
  mcpUrlTip: {
    zh: '提示：也可以打开扩展弹窗并点击“连接”来复制完整的客户端配置。',
    en: 'Tip: You can also open the extension popup and click "Connect" to copy a full client config snippet.',
  },
  troubleshootingTitle: { zh: '故障排查', en: 'Troubleshooting' },
  troubleshootingDesc: {
    zh: '仅当桥接程序注册或连接失败时才需要用到。',
    en: 'Use these only if the bridge fails to register or connect.',
  },
  diagnostics: { zh: '诊断命令', en: 'Diagnostics' },
  diagnosticsDescPre: { zh: '运行 ', en: 'Run ' },
  diagnosticsDescMid: {
    zh: ' 检查安装状态；如果报告错误，请运行自动修复命令 ',
    en: ' to check installation status. If it reports an error, run the auto-fix command ',
  },
  diagnosticsDescPost: { zh: '。', en: '.' },
  reportTitle: { zh: '报告问题', en: 'Report an issue' },
  reportDesc: {
    zh: '生成诊断报告并粘贴到 GitHub issue 中。',
    en: 'Generate a diagnostic report and paste it into a GitHub issue.',
  },
  reportTip: {
    zh: '报告会复制到剪贴板（敏感信息会自动脱敏）。',
    en: 'This copies the report to your clipboard (sensitive info is automatically redacted).',
  },
  openDocs: { zh: '打开故障排查文档', en: 'Open troubleshooting docs' },
} as const;

export type CopyKey = keyof typeof COPY;

/** Returns the localized string for `key` in `locale`. */
export function t(key: CopyKey, locale: Locale): string {
  return COPY[key][locale];
}

/** Persist the user's choice and apply it to the document. */
export function setLocale(next: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    // Ignore storage errors
  }
  applyLocale(next);
}

/** Sync the document <html lang> and <title> with the active locale. */
export function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  document.title = PAGE_TITLE[locale];
}

/**
 * Default locale: the persisted choice if present, otherwise derived from the
 * browser language (any `zh*` language maps to zh, everything else to en).
 */
export function detectDefaultLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  } catch {
    // Ignore storage errors
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
