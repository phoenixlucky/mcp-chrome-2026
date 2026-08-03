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
};

let config = DEFAULT_CONFIG;
const rotatingTabs = new Set<number>();
const rotationTimes = new Map<number, number[]>();

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
  let host = address.replace(/^https?:\/\//, '').replace(/\/$/, '');
  let port = Number(value.port ?? DEFAULT_CONFIG.port);
  let username = String(value.username ?? '').trim();
  let password = String(value.password ?? '');
  if (address.includes('@') || /^https?:\/\//.test(address) || /:\d+$/.test(address)) {
    try {
      const parsed = new URL(/^https?:\/\//.test(address) ? address : `http://${address}`);
      host = parsed.hostname;
      if (parsed.port) port = Number(parsed.port);
      if (parsed.username) username = decodeURIComponent(parsed.username);
      if (parsed.password) password = decodeURIComponent(parsed.password);
    } catch {
      throw new Error('代理连接串格式不正确');
    }
  }
  const sessionId = String(value.sessionId ?? '').trim();
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
  };

  if (!next.enabled) return next;
  if (!host || /[/@:]/.test(host)) throw new Error('代理地址必须是域名或 IP，不含协议和端口');
  if (!Number.isInteger(port) || port < 1 || port > 65535)
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
  return next;
}

export function createProxyPac(domains: string[], host: string, port: number): string {
  // Keep the exit-IP test endpoint on the proxy even when the user scopes browser traffic.
  const matches = ['api.ipify.org', ...domains]
    .map((domain) => domain.replace(/^\*\./, ''))
    .map(
      (domain) =>
        `host === ${JSON.stringify(domain)} || dnsDomainIs(host, ${JSON.stringify(`.${domain}`)})`,
    )
    .join(' || ');
  return `function FindProxyForURL(url, host) { if (${matches}) return ${JSON.stringify(`PROXY ${host}:${port}`)}; return "DIRECT"; }`;
}

function nextSessionId(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0])
    .padStart(10, '0')
    .slice(-10);
}

export function shouldRotatePage(statusCode: number): boolean {
  return statusCode === 403 || statusCode === 429 || statusCode >= 500;
}

async function rotateAndReload(tabId: number): Promise<void> {
  if (tabId < 0 || !config.enabled || !config.rotateOnError || rotatingTabs.has(tabId)) return;
  const now = Date.now();
  const recent = (rotationTimes.get(tabId) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 3) return;

  rotatingTabs.add(tabId);
  rotationTimes.set(tabId, [...recent, now]);
  try {
    await saveProxyConfig({ ...config, sessionId: nextSessionId() });
    await chrome.tabs.reload(tabId);
  } finally {
    rotatingTabs.delete(tabId);
  }
}

async function testProxyConnection(): Promise<{ ip: string; country?: string }> {
  if (!config.enabled) throw new Error('请先启用并保存代理');
  const response = await fetch('https://api.ipify.org?format=json', {
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`代理测试失败（HTTP ${response.status}）`);
  const result = (await response.json()) as { ip?: unknown };
  if (typeof result.ip !== 'string') throw new Error('代理测试未返回出口 IP');
  try {
    const locationResponse = await fetch(
      `https://ipinfo.io/${encodeURIComponent(result.ip)}/json`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      },
    );
    const location = (await locationResponse.json()) as { country?: unknown };
    if (typeof location.country === 'string') {
      const country = new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(location.country);
      return { ip: result.ip, country: country ?? location.country };
    }
  } catch {
    // A location lookup failure should not hide a successful proxy connection.
  }
  return { ip: result.ip };
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
            pacScript: { data: createProxyPac(next.domains, next.host, next.port) },
          }
        : {
            mode: 'fixed_servers' as const,
            rules: {
              singleProxy: { scheme: 'http', host: next.host, port: next.port },
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
      if (config.enabled && details.isProxy && details.challenger.host === config.host) {
        callback({
          authCredentials: {
            username: buildProxyUsername(config.username, config.sessionId, config.countryCode),
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
        void rotateAndReload(details.tabId);
      }
    },
    { urls: ['<all_urls>'], types: ['main_frame'] },
  );
  chrome.webRequest.onErrorOccurred.addListener(
    (details) => {
      if (details.type === 'main_frame') void rotateAndReload(details.tabId);
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
      testProxyConnection()
        .then((result) => sendResponse({ success: true, ...result }))
        .catch((error) => sendResponse({ success: false, error: String(error.message ?? error) }));
      return true;
    }
  });
}
