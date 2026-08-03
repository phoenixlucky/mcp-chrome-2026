import { STORAGE_KEYS } from '@/common/constants';

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
const rotationTimes = new Map<number, number[]>();
let lastProxyAuth: { host: string; port: number; matched: boolean; at: number } | undefined;

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
  if (/-sessid-[^-]+/.test(username)) {
    return username.replace(/-sessid-[^-]+/, `-sessid-${sessionId}`);
  }
  return username.includes('-sesstime-')
    ? username.replace('-sesstime-', `-sessid-${sessionId}-sesstime-`)
    : `${username}-sessid-${sessionId}`;
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
  }

  if (next.endpointType === 'country') {
    if (next.countryCode === 'us') {
      next.host = 'us-pr.oxylabs.io';
      next.port = next.protocol === 'https' ? 10001 : 10000;
    } else if (next.countryCode === 'ca') {
      next.host = 'ca-pr.oxylabs.io';
      next.port = next.protocol === 'https' ? 30001 : 30000;
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
  if (endpointType === 'country' && !['us', 'ca'].includes(countryCode)) {
    throw new Error('具体国家/地区入口目前请选择美国或加拿大');
  }
  if (protocol === 'socks5')
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

export function shouldRotatePage(statusCode: number): boolean {
  return statusCode === 403 || statusCode === 429 || statusCode >= 500;
}

export function isFatalProxyNetworkError(error?: string): boolean {
  return /ERR_(?:PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED)/.test(error ?? '');
}

export function isClosedTabError(error: unknown): boolean {
  return /No tab with id:/i.test(String(error));
}

async function rotateAndReload(tabId: number, error?: string): Promise<void> {
  if (tabId < 0 || !config.enabled || !config.rotateOnError || rotatingTabs.has(tabId)) return;
  const now = Date.now();
  const recent = (rotationTimes.get(tabId) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 2 && isFatalProxyNetworkError(error)) {
    await saveProxyConfig({ ...config, enabled: false });
    return;
  }
  if (recent.length >= 3) return;

  rotatingTabs.add(tabId);
  rotationTimes.set(tabId, [...recent, now]);
  try {
    await saveProxyConfig({ ...config, sessionId: nextSessionId() });
    await chrome.tabs.reload(tabId);
  } catch (reloadError) {
    if (!isClosedTabError(reloadError)) throw reloadError;
  } finally {
    rotatingTabs.delete(tabId);
  }
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
  await chrome.storage.local.set({ [STORAGE_KEYS.PROXY_CONFIG]: config });
  return config;
}

export function initProxyManager(): void {
  chrome.storage.local
    .get(STORAGE_KEYS.PROXY_CONFIG)
    .then(async (stored) => {
      config = normalizeProxyConfig(stored[STORAGE_KEYS.PROXY_CONFIG] ?? DEFAULT_CONFIG);
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
              config.sessionId,
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
        void rotateAndReload(details.tabId).catch(console.warn);
      }
    },
    { urls: ['<all_urls>'], types: ['main_frame'] },
  );
  chrome.webRequest.onErrorOccurred.addListener(
    (details) => {
      if (details.type === 'main_frame')
        void rotateAndReload(details.tabId, details.error).catch(console.warn);
    },
    { urls: ['<all_urls>'], types: ['main_frame'] },
  );
  chrome.tabs.onRemoved.addListener((tabId) => rotationTimes.delete(tabId));

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'proxy_configure') {
      saveProxyConfig(message.config)
        .then((saved) => sendResponse({ success: true, config: saved }))
        .catch((error) => sendResponse({ success: false, error: String(error.message ?? error) }));
      return true;
    }
    if (message?.type === 'proxy_test') {
      runProxyTest().then(sendResponse).catch(console.warn);
      return true;
    }
  });
}
