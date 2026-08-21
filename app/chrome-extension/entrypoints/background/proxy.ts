import { PROXY_COUNTRIES, STORAGE_KEYS } from '@/common/constants';

export type ProxyConfig = {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  sessionId: string;
  rotateOnError: boolean;
  domains: string[];
  countryCode: string;
  endpointType: 'reverse' | 'country';
  accessRegion: 'global' | 'beijing' | 'hongkong' | 'custom';
  protocol: 'http' | 'https' | 'socks5';
};

type ProxyTestResult = {
  success: boolean;
  pending?: boolean;
  ip?: string;
  country?: string;
  error?: string;
  checkedAt: number;
};

const DEFAULT_CONFIG: ProxyConfig = {
  enabled: false,
  host: '',
  port: 7777,
  username: '',
  password: '',
  sessionId: '',
  rotateOnError: true,
  domains: [],
  countryCode: '',
  endpointType: 'reverse',
  accessRegion: 'global',
  protocol: 'http',
};

let config = DEFAULT_CONFIG;
const rotatingTabs = new Set<number>();
const rotationTimes = new Map<string, number[]>();
let sessionIdsByScope: Record<string, string> = {};
let lastProxyAuth: { host: string; port: number; matched: boolean; at: number } | undefined;
const AUTO_ROTATION_COOLDOWN_MS = 5 * 60_000;
const AUTO_ROTATION_WINDOW_MS = 60 * 60_000;
const EXPLICIT_ROTATION_WINDOW_MS = 60_000;
const MAX_EXPLICIT_ROTATIONS_PER_WINDOW = 3;
const DEFAULT_SESSION_TIME_MINUTES = 5;

function applyCountryCode(username: string, countryCode: string): string {
  if (!countryCode) return username;
  if (countryCode === 'random') return username.replace(/-cc-[a-z]{2}(?=-|$)/i, '');
  if (/-cc-[a-z]{2}(?=-|$)/i.test(username)) {
    return username.replace(/-cc-[a-z]{2}(?=-|$)/i, `-cc-${countryCode}`);
  }
  return username.includes('-sessid-')
    ? username.replace('-sessid-', `-cc-${countryCode}-sessid-`)
    : username.includes('-sesstime-')
      ? username.replace('-sesstime-', `-cc-${countryCode}-sesstime-`)
      : `${username}-cc-${countryCode}`;
}

export function buildProxyUsername(username: string, sessionId: string, countryCode = ''): string {
  username = applyCountryCode(username, countryCode);
  if (!sessionId) return username;
  if (/-sessid-/.test(username)) {
    username = username.replace(/-sessid-.+?(?=-sesstime-|$)/, `-sessid-${sessionId}`);
  } else if (username.includes('-sesstime-')) {
    username = username.replace('-sesstime-', `-sessid-${sessionId}-sesstime-`);
  } else {
    username = `${username}-sessid-${sessionId}`;
  }
  return username.includes('-sesstime-')
    ? username
    : `${username}-sesstime-${DEFAULT_SESSION_TIME_MINUTES}`;
}

export function normalizeProxyConfig(value: Partial<ProxyConfig>): ProxyConfig {
  const address = String(value.host ?? '').trim();
  let host = address.replace(/^[a-z0-9]+:\/\//i, '').replace(/\/$/, '');
  let port = Number(value.port ?? DEFAULT_CONFIG.port);
  let username = String(value.username ?? '').trim();
  let password = String(value.password ?? '');
  let protocol: ProxyConfig['protocol'] =
    value.protocol === 'https' ? 'https' : value.protocol === 'socks5' ? 'socks5' : 'http';
  if (address.includes('@') || /^[a-z0-9]+:\/\//i.test(address) || /:\d+$/.test(address)) {
    try {
      const parsed = new URL(/^[a-z0-9]+:\/\//i.test(address) ? address : `http://${address}`);
      host = parsed.hostname;
      if (parsed.port) port = Number(parsed.port);
      if (parsed.username) username = decodeURIComponent(parsed.username);
      if (parsed.password) password = decodeURIComponent(parsed.password);
      protocol =
        parsed.protocol === 'https:'
          ? 'https'
          : /^socks5h?:$/i.test(parsed.protocol)
            ? 'socks5'
            : 'http';
    } catch {
      throw new Error('代理连接串格式不正确');
    }
  }
  const sessionId = String(value.sessionId ?? '').trim();
  const endpointType: ProxyConfig['endpointType'] =
    value.endpointType === 'country' ? 'country' : 'reverse';
  const accessRegion: ProxyConfig['accessRegion'] =
    value.accessRegion === 'beijing' ||
    value.accessRegion === 'hongkong' ||
    value.accessRegion === 'custom'
      ? value.accessRegion
      : host === 'cnt9t1is.com'
        ? 'beijing'
        : host === 'a81298871.com'
          ? 'hongkong'
          : 'global';
  const countryCode = String(
    value.countryCode === undefined
      ? (username.match(/-cc-([a-z]{2})(?=-|$)/i)?.[1] ?? '')
      : value.countryCode,
  )
    .trim()
    .toLowerCase();
  const domains = Array.isArray(value.domains)
    ? [
        ...new Set(
          value.domains.map((domain) => String(domain).trim().toLowerCase()).filter(Boolean),
        ),
      ]
    : [];
  const next = {
    enabled: value.enabled === true,
    host,
    port,
    username,
    password,
    sessionId,
    rotateOnError: value.rotateOnError !== false,
    domains,
    countryCode,
    endpointType,
    accessRegion,
    protocol,
  };

  if (next.endpointType === 'reverse') {
    const entries: Partial<Record<ProxyConfig['accessRegion'], [string, number]>> = {
      global: ['pr.oxylabs.io', 7777],
      beijing: ['cnt9t1is.com', 8000],
      hongkong: ['a81298871.com', 8000],
    };
    const entry = entries[next.accessRegion];
    if (entry) [next.host, next.port] = entry;
    // Oxylabs documents the Beijing/Hong Kong entry nodes as HTTPS proxy
    // nodes. Force the matching Chrome scheme for old saved configs too.
    if (next.accessRegion === 'beijing' || next.accessRegion === 'hongkong') {
      next.protocol = 'https';
    }
  }

  if (next.endpointType === 'country') {
    const countryEntry = PROXY_COUNTRIES.find((entry) => entry.code === next.countryCode);
    if (countryEntry) {
      next.host = `${countryEntry.code}-pr.oxylabs.io`;
      next.port = next.protocol === 'https' ? countryEntry.httpsPort : countryEntry.httpPort;
    }
    next.username = next.username.replace(/-cc-[a-z]{2}(?=-|$)/i, '');
    if (next.username && !next.username.startsWith('customer-')) {
      next.username = `customer-${next.username}`;
    }
  }

  if (!next.enabled) return next;
  if (!next.host || /[/@:]/.test(next.host))
    throw new Error('代理地址必须是域名或 IP，不含协议和端口');
  if (!Number.isInteger(next.port) || next.port < 1 || next.port > 65535)
    throw new Error('代理端口必须在 1 到 65535 之间');
  if (!next.username || !next.password) throw new Error('启用代理需要用户名和密码');
  if (sessionId && !/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) {
    throw new Error('会话 ID 只能包含字母、数字、下划线和连字符');
  }
  if (domains.some((domain) => !/^(?:\*\.)?[a-z0-9.-]+$/.test(domain))) {
    throw new Error('网站范围只能填写域名，如 example.com 或 *.example.com');
  }
  if (countryCode && countryCode !== 'random' && !/^[a-z]{2}$/.test(countryCode)) {
    throw new Error('国家代码必须是两个字母，如 us 或 ca');
  }
  if (endpointType === 'country' && !PROXY_COUNTRIES.some((entry) => entry.code === countryCode)) {
    throw new Error('当前国家/地区没有配置 Oxylabs 专用入口，请改用反向连接入口');
  }
  if (next.protocol === 'socks5')
    throw new Error('Oxylabs SOCKS5 当前不支持 Chrome，请选择 HTTP 或 HTTPS');
  return next;
}

export function createProxyPac(
  domains: string[],
  host: string,
  port: number,
  protocol: ProxyConfig['protocol'] = 'http',
): string {
  // Keep the Oxylabs verification endpoint on the proxy even when the user scopes browser traffic.
  const matches = ['ip.oxylabs.io', ...domains]
    .map((domain) => domain.replace(/^\*\./, ''))
    .map(
      (domain) =>
        `host === ${JSON.stringify(domain)} || dnsDomainIs(host, ${JSON.stringify(`.${domain}`)})`,
    )
    .join(' || ');
  const type = protocol === 'https' ? 'HTTPS' : 'PROXY';
  return `function FindProxyForURL(url, host) { if (${matches}) return ${JSON.stringify(`${type} ${host}:${port}`)}; return "DIRECT"; }`;
}

function nextSessionId(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0])
    .padStart(10, '0')
    .slice(-10);
}

function sessionIdFromUsername(username: string): string | undefined {
  return username.match(/-sessid-(.+?)(?=-sesstime-|$)/)?.[1];
}

function registrableDomain(host: string): string {
  const labels = host.toLowerCase().split('.').filter(Boolean);
  return labels.length > 2 ? labels.slice(-2).join('.') : labels.join('.');
}

export function getProxyScope(url: string, domains: string[] = config.domains): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const configuredDomain = domains
      .map((domain) => domain.replace(/^\*\./, '').toLowerCase())
      .filter((domain) => host === domain || host.endsWith(`.${domain}`))
      .sort((a, b) => b.length - a.length)[0];
    return configuredDomain ?? registrableDomain(host);
  } catch {
    return '';
  }
}

function isProxyScopedUrl(url: string): boolean {
  if (!config.domains.length) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return config.domains.some((domain) => {
      const normalized = domain.replace(/^\*\./, '').toLowerCase();
      return host === normalized || host.endsWith(`.${normalized}`);
    });
  } catch {
    return false;
  }
}

function persistSessionIds(): void {
  void chrome.storage.local.set({ [STORAGE_KEYS.PROXY_SESSION_IDS]: sessionIdsByScope });
}

function sessionIdForUrl(url: string): string {
  const scope = getProxyScope(url) || 'global';
  const existing = sessionIdsByScope[scope];
  if (existing) return existing;

  // An explicitly configured session (or one already embedded in the username)
  // remains the source of truth. Otherwise create a stable per-site session so
  // a normal page load does not receive a new residential IP for every request.
  const configured = config.sessionId || sessionIdFromUsername(config.username);
  if (configured) return configured;

  const generated = nextSessionId();
  sessionIdsByScope[scope] = generated;
  persistSessionIds();
  return generated;
}

function rotateSessionForUrl(url: string): void {
  const scope = getProxyScope(url) || 'global';
  sessionIdsByScope[scope] = nextSessionId();
  persistSessionIds();
}

function rotateCountryStickyPort(): void {
  if (config.endpointType !== 'country') return;
  const entry = PROXY_COUNTRIES.find((country) => country.code === config.countryCode);
  if (!entry) return;

  // Oxylabs sticky country entries use a port range. Reusing the same port
  // keeps the same IP even when the username session id changes.
  const rangeStart = entry.httpsPort;
  const rangeSize = 999;
  const randomOffset = crypto.getRandomValues(new Uint32Array(1))[0] % rangeSize;
  let nextPort = rangeStart + randomOffset;
  if (nextPort === config.port) nextPort = rangeStart + ((randomOffset + 1) % rangeSize);
  config = { ...config, port: nextPort };
}

async function reconnectProxy(): Promise<void> {
  // Reapplying the same proxy settings does not always evict Chrome's cached
  // proxy-authenticated connection. Clear and restore the extension-owned
  // setting so the next request challenges with the new session id.
  await chrome.proxy.settings.clear({ scope: 'regular' });
  await applyProxyConfig(config);
}

export function shouldRotatePage(statusCode: number): boolean {
  return statusCode === 403 || statusCode === 429 || statusCode >= 500;
}

const KNOWN_PAGE_ERROR = /oops!!\s*something went wrong\.\s*please refresh page/i;

export function isKnownPageError(text: string): boolean {
  return KNOWN_PAGE_ERROR.test(text.replace(/\s+/g, ' '));
}

export function isFatalProxyNetworkError(error?: string): boolean {
  return /ERR_(?:PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED)/.test(error ?? '');
}

export function shouldRotateNetworkError(error?: string): boolean {
  return isFatalProxyNetworkError(error);
}

export function isClosedTabError(error: unknown): boolean {
  return /No tab with id:/i.test(String(error));
}

type ProxyRotationResult = {
  rotated: boolean;
  tabId: number;
  skipped?: string;
};

async function rotateAndReload(
  tabId: number,
  error?: string,
  explicit = false,
  pageUrl?: string,
): Promise<ProxyRotationResult> {
  if (tabId < 0) return { rotated: false, tabId, skipped: 'invalid_tab' };
  if (!config.enabled) return { rotated: false, tabId, skipped: 'proxy_disabled' };
  if (!explicit && !config.rotateOnError)
    return { rotated: false, tabId, skipped: 'auto_rotation_disabled' };
  if (rotatingTabs.has(tabId)) return { rotated: false, tabId, skipped: 'rotation_in_progress' };
  const url =
    pageUrl ??
    (await chrome.tabs
      .get(tabId)
      .then((tab) => tab.url ?? '')
      .catch(() => ''));
  if (!explicit && !isProxyScopedUrl(url))
    return { rotated: false, tabId, skipped: 'outside_proxy_scope' };
  const scope = getProxyScope(url) || `tab:${tabId}`;
  const rotationKey = `${explicit ? 'explicit' : 'auto'}:${scope}`;
  const now = Date.now();
  const windowMs = explicit ? EXPLICIT_ROTATION_WINDOW_MS : AUTO_ROTATION_WINDOW_MS;
  const recent = (rotationTimes.get(rotationKey) ?? []).filter((time) => now - time < windowMs);
  const lastRotation = recent.at(-1);
  // Keep the same residential IP for a useful period. A 429/403 response is
  // not permission to repeatedly cycle through the pool.
  if (!explicit && lastRotation !== undefined && now - lastRotation < AUTO_ROTATION_COOLDOWN_MS)
    return { rotated: false, tabId, skipped: 'auto_rotation_cooldown' };
  if (recent.length >= 2 && isFatalProxyNetworkError(error)) {
    await saveProxyConfig({ ...config, enabled: false });
    return { rotated: false, tabId, skipped: 'proxy_disabled_after_fatal_error' };
  }
  if (explicit && recent.length >= MAX_EXPLICIT_ROTATIONS_PER_WINDOW)
    return { rotated: false, tabId, skipped: 'rate_limited' };

  rotatingTabs.add(tabId);
  rotationTimes.set(rotationKey, [...recent, now]);
  try {
    rotateCountryStickyPort();
    rotateSessionForUrl(url);
    await reconnectProxy();
    await chrome.tabs.reload(tabId, { bypassCache: true });
    return { rotated: true, tabId };
  } catch (reloadError) {
    if (!isClosedTabError(reloadError)) throw reloadError;
    return { rotated: true, tabId, skipped: 'tab_closed_after_rotation' };
  } finally {
    rotatingTabs.delete(tabId);
  }
}

async function pageContainsKnownError(tabId: number): Promise<boolean> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: async () => {
      const hasError = () =>
        /oops!!\s*something went wrong\.\s*please refresh page/i.test(
          (document.body?.innerText ?? '').replace(/\s+/g, ' '),
        );
      const deadline = Date.now() + 3_000;
      do {
        if (hasError()) return true;
        await new Promise((resolve) => setTimeout(resolve, 300));
      } while (Date.now() < deadline);
      return hasError();
    },
  });
  return injection?.result === true;
}

async function detectPageErrorAndRotate(tabId: number): Promise<void> {
  if (tabId < 0 || !config.enabled || !config.rotateOnError) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isProxyScopedUrl(tab.url ?? '')) return;
    if (await pageContainsKnownError(tabId)) await rotateAndReload(tabId);
  } catch (error) {
    if (!isClosedTabError(error)) console.debug('页面异常检测跳过:', error);
  }
}

export async function rotateProxyForTab(
  tabId: number,
  reason: string,
): Promise<ProxyRotationResult & { reason: string }> {
  if (!Number.isInteger(tabId) || tabId < 0)
    throw new Error('tabId must be a non-negative integer');
  const result = await rotateAndReload(tabId, undefined, true);
  if (!result.rotated && result.skipped === 'proxy_disabled') throw new Error('请先启用并保存代理');
  if (!result.rotated && result.skipped === 'rate_limited')
    throw new Error('该站点 1 分钟内已轮换 3 次，请稍后再试');
  return { ...result, reason };
}

export async function getProxyDiagnostics(
  testConnection = false,
): Promise<Record<string, unknown>> {
  const settings = await chrome.proxy.settings.get({ incognito: false });
  const diagnostics: Record<string, unknown> = {
    enabled: config.enabled,
    host: config.enabled ? config.host : undefined,
    port: config.enabled ? config.port : undefined,
    scopedDomains: config.enabled ? config.domains : [],
    credentialsConfigured: config.enabled && Boolean(config.username && config.password),
    rotateOnError: config.rotateOnError,
    stickySessionScopes: Object.keys(sessionIdsByScope),
    automaticRotationPolicy: {
      cooldownMs: AUTO_ROTATION_COOLDOWN_MS,
      maxPerHour: null,
    },
    chrome: {
      mode: settings.value?.mode,
      levelOfControl: settings.levelOfControl,
    },
  };
  if (!testConnection) return diagnostics;

  lastProxyAuth = undefined;
  const startedAt = Date.now();
  try {
    diagnostics.connection = { ok: true, elapsedMs: 0, ...(await testProxyConnection()) };
  } catch (error) {
    diagnostics.connection = {
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: String(error instanceof Error ? error.message : error),
    };
  }
  if ((diagnostics.connection as { ok: boolean }).ok)
    (diagnostics.connection as { elapsedMs: number }).elapsedMs = Date.now() - startedAt;
  diagnostics.proxyAuth = lastProxyAuth;
  return diagnostics;
}

async function testProxyConnection(): Promise<{ ip: string; country?: string }> {
  if (!config.enabled) throw new Error('请先启用并保存代理');
  const response = await fetch('https://ip.oxylabs.io/location', {
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`代理测试失败（HTTP ${response.status}）`);
  const result = (await response.json()) as { ip?: unknown; country?: unknown };
  if (typeof result.ip !== 'string') throw new Error('代理测试未返回出口 IP');
  return {
    ip: result.ip,
    ...(typeof result.country === 'string' ? { country: result.country } : {}),
  };
}

async function runProxyTest(): Promise<ProxyTestResult> {
  lastProxyAuth = undefined;
  await chrome.storage.local.set({
    [STORAGE_KEYS.PROXY_TEST_RESULT]: { success: false, pending: true, checkedAt: Date.now() },
  });
  try {
    const result = await testProxyConnection();
    const saved: ProxyTestResult = { success: true, ...result, checkedAt: Date.now() };
    await chrome.storage.local.set({ [STORAGE_KEYS.PROXY_TEST_RESULT]: saved });
    return saved;
  } catch (error) {
    const detail = String(error instanceof Error ? error.message : error);
    const saved: ProxyTestResult = {
      success: false,
      error: /timed out/i.test(detail)
        ? '代理测试超时（30 秒）：请检查代理账号、密码和网络连接'
        : detail,
      checkedAt: Date.now(),
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.PROXY_TEST_RESULT]: saved });
    return saved;
  }
}

async function applyProxyConfig(next: ProxyConfig): Promise<void> {
  if (!next.enabled) {
    await chrome.proxy.settings.clear({ scope: 'regular' });
    return;
  }

  await chrome.proxy.settings.set({
    scope: 'regular',
    value: {
      ...(next.domains.length
        ? {
            mode: 'pac_script' as const,
            pacScript: { data: createProxyPac(next.domains, next.host, next.port, next.protocol) },
          }
        : {
            mode: 'fixed_servers' as const,
            rules: {
              singleProxy: { scheme: next.protocol, host: next.host, port: next.port },
              bypassList: ['<local>'],
            },
          }),
    },
  });
}

async function saveProxyConfig(value: Partial<ProxyConfig>): Promise<ProxyConfig> {
  const next = normalizeProxyConfig(value);
  await applyProxyConfig(next);
  config = next;
  // A user edit (including disabling the proxy) starts a fresh session set;
  // otherwise an old site's sticky session could survive a credential or geo change.
  sessionIdsByScope = {};
  rotationTimes.clear();
  await chrome.storage.local.set({
    [STORAGE_KEYS.PROXY_CONFIG]: config,
    [STORAGE_KEYS.PROXY_SESSION_IDS]: sessionIdsByScope,
  });
  return config;
}

export function initProxyManager(): void {
  chrome.storage.local
    .get([STORAGE_KEYS.PROXY_CONFIG, STORAGE_KEYS.PROXY_SESSION_IDS])
    .then(async (stored) => {
      config = normalizeProxyConfig(stored[STORAGE_KEYS.PROXY_CONFIG] ?? DEFAULT_CONFIG);
      const savedSessions = stored[STORAGE_KEYS.PROXY_SESSION_IDS];
      sessionIdsByScope = {};
      if (savedSessions && typeof savedSessions === 'object' && !Array.isArray(savedSessions)) {
        for (const [scope, id] of Object.entries(savedSessions as Record<string, unknown>)) {
          if (typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id)) {
            sessionIdsByScope[scope] = id;
          }
        }
      }
      if (config.enabled) await applyProxyConfig(config);
    })
    .catch(() => {
      // Keep the browser's existing proxy settings untouched when saved config is invalid.
      config = DEFAULT_CONFIG;
    });

  chrome.webRequest.onAuthRequired.addListener(
    (details, callback) => {
      if (!callback) return;
      const matched = config.enabled && details.isProxy && details.challenger.host === config.host;
      if (details.isProxy) {
        lastProxyAuth = {
          host: details.challenger.host,
          port: details.challenger.port,
          matched,
          at: Date.now(),
        };
      }
      if (matched) {
        callback({
          authCredentials: {
            username: buildProxyUsername(
              config.username,
              sessionIdForUrl(details.url ?? ''),
              config.endpointType === 'reverse' ? config.countryCode : '',
            ),
            password: config.password,
          },
        });
        return;
      }
      callback({});
    },
    { urls: ['<all_urls>'] },
    ['asyncBlocking'],
  );

  chrome.webRequest.onCompleted.addListener(
    (details) => {
      if (details.type === 'main_frame' && shouldRotatePage(details.statusCode)) {
        void rotateAndReload(details.tabId, undefined, false, details.url).catch(console.warn);
      }
    },
    { urls: ['<all_urls>'], types: ['main_frame'] },
  );
  chrome.webRequest.onErrorOccurred.addListener(
    (details) => {
      if (details.type === 'main_frame' && shouldRotateNetworkError(details.error))
        void rotateAndReload(details.tabId, details.error, false, details.url).catch(console.warn);
    },
    { urls: ['<all_urls>'], types: ['main_frame'] },
  );
  chrome.webNavigation.onCompleted.addListener((details) => {
    if (details.frameId === 0) void detectPageErrorAndRotate(details.tabId);
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    for (const key of rotationTimes.keys()) {
      if (key.endsWith(`:tab:${tabId}`)) rotationTimes.delete(key);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'proxy_configure') {
      saveProxyConfig(message.config)
        .then((saved) => sendResponse({ success: true, config: saved }))
        .catch((error) => sendResponse({ success: false, error: String(error.message ?? error) }));
      return true;
    }
    if (message?.type === 'proxy_rotate_current') {
      const requestedTabId = Number(message.tabId);
      const tabPromise = Number.isInteger(requestedTabId)
        ? Promise.resolve({ id: requestedTabId } as chrome.tabs.Tab)
        : chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => tab);
      tabPromise
        .then((tab) => {
          if (!tab?.id) throw new Error('当前没有可切换代理的网页标签');
          return rotateProxyForTab(tab.id, String(message.reason || '用户手动切换 IP'));
        })
        .then((result) => sendResponse({ success: true, result }))
        .catch((error) => sendResponse({ success: false, error: String(error.message ?? error) }));
      return true;
    }
    if (message?.type === 'proxy_test') {
      runProxyTest().then(sendResponse).catch(console.warn);
      return true;
    }
  });
}
