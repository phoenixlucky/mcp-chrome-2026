import { execFile, execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAgentDataDir } from './agent/storage.js';

const execFileAsync = promisify(execFile);
const PROFILE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const RESERVED_CHROME_ARGS = [
  '--user-data-dir',
  '--remote-debugging-port',
  '--remote-debugging-address',
];

export interface BrowserProfile {
  id: string;
  name: string;
  userDataDir: string;
  chromePath?: string;
  extensionPath?: string;
  launchArgs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BrowserProfileInput {
  id?: string;
  name: string;
  userDataDir?: string;
  chromePath?: string;
  extensionPath?: string;
  launchArgs?: string[];
}

export interface BrowserProfileStatus extends BrowserProfile {
  status: 'stopped' | 'starting' | 'running';
  pid?: number;
  cdpUrl?: string;
  mcpUrl?: string;
  extensionLoaded: boolean;
  mcpReady: boolean;
  activeCalls?: number;
}

export interface BrowserProfileDiagnostics {
  profile: BrowserProfileStatus;
  cdp: Record<string, unknown> | null;
  server: Record<string, unknown> | null;
  proxy: unknown;
  errors: string[];
}

interface RunningProfile {
  child: ChildProcess;
  cdpPort: number;
  mcpPort?: number;
  extensionLoaded: boolean;
  mcpReady: boolean;
  activeCalls: number;
  connection?: ProfileMcpConnection;
}

interface ProfileFile {
  profiles: BrowserProfile[];
}

class ProfileMcpConnection {
  private readonly client: Client;
  private readonly transport: StreamableHTTPClientTransport;
  private connected = false;
  private connecting: Promise<void> | null = null;

  constructor(private readonly port: number) {
    this.transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
    this.client = new Client({ name: 'chrome-mcp-profile-proxy', version: '2.3.0' }, {});
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<CallToolResult> {
    if (!this.connected) {
      this.connecting ||= this.client
        .connect(this.transport)
        .then(() => undefined)
        .finally(() => {
          this.connecting = null;
        });
      await this.connecting;
      this.connected = true;
    }
    return (await this.client.callTool(
      { name, arguments: args },
      undefined,
      signal ? { signal } : undefined,
    )) as CallToolResult;
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    await this.client.close().catch(() => undefined);
  }
}

function profileRoot(): string {
  const configured = process.env.CHROME_MCP_PROFILE_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(getAgentDataDir(), 'browser-profiles');
}

function profileFilePath(): string {
  return path.join(profileRoot(), 'profiles.json');
}

function safeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function normalizeLaunchArgs(args: unknown): string[] {
  if (args === undefined) return [];
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
    throw new Error('launchArgs must be an array of strings');
  }
  const normalized = args.map((arg) => arg.trim()).filter(Boolean);
  const reserved = normalized.filter((arg) =>
    RESERVED_CHROME_ARGS.some((prefix) => arg === prefix || arg.startsWith(`${prefix}=`)),
  );
  if (reserved.length) {
    throw new Error(`launchArgs cannot override manager-owned flags: ${reserved.join(', ')}`);
  }
  return normalized;
}

async function reservePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function validFile(pathValue: string | undefined): string | undefined {
  return pathValue?.trim() ? path.resolve(pathValue.trim()) : undefined;
}

function parseToolJson(result: CallToolResult): unknown {
  const text = result.content?.find((item) => item.type === 'text');
  if (!text || text.type !== 'text') return result;
  try {
    return JSON.parse(text.text);
  } catch {
    return text.text;
  }
}

function extensionCandidates(): string[] {
  return [
    process.env.CHROME_MCP_EXTENSION_PATH,
    path.resolve(__dirname, '../../chrome-extension/.output/chrome-mv3'),
    path.resolve(process.cwd(), 'app/chrome-extension/.output/chrome-mv3'),
    path.resolve(process.cwd(), 'chrome-extension/.output/chrome-mv3'),
  ].filter((value): value is string => Boolean(value?.trim()));
}

async function firstExistingDirectory(candidates: string[]): Promise<string | undefined> {
  for (const candidate of candidates) {
    try {
      if ((await fs.stat(candidate)).isDirectory()) return path.resolve(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  return undefined;
}

function chromeCandidates(): string[] {
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  if (process.platform === 'win32') {
    return [
      process.env.CHROME_MCP_CHROME_PATH,
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Chromium', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Chromium', 'Application', 'chrome.exe'),
    ].filter((value): value is string => Boolean(value?.trim()));
  }
  if (process.platform === 'darwin') {
    return [
      process.env.CHROME_MCP_CHROME_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ].filter((value): value is string => Boolean(value?.trim()));
  }
  return [
    process.env.CHROME_MCP_CHROME_PATH,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ].filter((value): value is string => Boolean(value?.trim()));
}

async function resolveChromePath(configured?: string): Promise<string> {
  const candidates = [configured, ...chromeCandidates()].filter((value): value is string =>
    Boolean(value?.trim()),
  );
  for (const candidate of candidates) {
    if (candidate.includes(path.sep) || path.isAbsolute(candidate)) {
      try {
        if ((await fs.stat(candidate)).isFile()) return candidate;
      } catch {
        // Try the next candidate.
      }
      continue;
    }
    try {
      const resolved = execFileSync(process.platform === 'win32' ? 'where' : 'which', [candidate], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .split(/\r?\n/)
        .map((value) => value.trim())
        .find(Boolean);
      if (resolved) return resolved;
    } catch {
      // Try the next executable name.
    }
  }
  throw new Error(
    'Chrome executable not found. Set CHROME_MCP_CHROME_PATH or pass chromePath when creating the profile.',
  );
}

async function fetchJson(url: string, timeoutMs = 1_500): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const value = (await response.json()) as unknown;
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForMcp(port: number, timeoutMs = 15_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await fetchJson(`http://127.0.0.1:${port}/status?probe=1`, 1_000);
    if (
      status?.probe &&
      typeof status.probe === 'object' &&
      (status.probe as Record<string, unknown>).ok === true
    )
      return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

export class BrowserProfileManager {
  private profiles: BrowserProfile[] | null = null;
  private loading: Promise<BrowserProfile[]> | null = null;
  private readonly running = new Map<string, RunningProfile>();
  private readonly starting = new Set<string>();
  private saveQueue: Promise<void> = Promise.resolve();

  private async load(): Promise<BrowserProfile[]> {
    if (this.profiles) return this.profiles;
    this.loading ||= (async () => {
      try {
        const raw = JSON.parse(await fs.readFile(profileFilePath(), 'utf8')) as Partial<ProfileFile>;
        return Array.isArray(raw.profiles) ? raw.profiles : [];
      } catch {
        return [];
      }
    })();
    this.profiles = await this.loading;
    this.loading = null;
    return this.profiles;
  }

  private async save(): Promise<void> {
    const write = async () => {
      const profiles = await this.load();
      await fs.mkdir(profileRoot(), { recursive: true });
      const tempPath = `${profileFilePath()}.${process.pid}.${randomUUID()}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify({ profiles }, null, 2), 'utf8');
      await fs.rename(tempPath, profileFilePath());
    };
    this.saveQueue = this.saveQueue.then(write, write);
    await this.saveQueue;
  }

  private status(profile: BrowserProfile): BrowserProfileStatus {
    const active = this.running.get(profile.id);
    const starting = this.starting.has(profile.id);
    return {
      ...profile,
      status: active ? 'running' : starting ? 'starting' : 'stopped',
      ...(active?.child.pid ? { pid: active.child.pid } : {}),
      ...(active
        ? {
            cdpUrl: `http://127.0.0.1:${active.cdpPort}`,
            ...(active.mcpPort ? { mcpUrl: `http://127.0.0.1:${active.mcpPort}/mcp` } : {}),
          }
        : {}),
      extensionLoaded: active?.extensionLoaded ?? false,
      mcpReady: active?.mcpReady ?? false,
      ...(active ? { activeCalls: active.activeCalls } : {}),
    };
  }

  async list(): Promise<BrowserProfileStatus[]> {
    return (await this.load()).map((profile) => this.status(profile));
  }

  async create(input: BrowserProfileInput): Promise<BrowserProfileStatus> {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('name is required');
    const profiles = await this.load();
    const id = String(input.id || safeName(name) || `profile-${randomUUID().slice(0, 8)}`).trim();
    if (!PROFILE_ID_RE.test(id)) throw new Error('id must contain only letters, numbers, _ or -');
    if (profiles.some((profile) => profile.id === id))
      throw new Error(`Profile already exists: ${id}`);

    const userDataDir = path.resolve(input.userDataDir?.trim() || path.join(profileRoot(), id));
    const chromePath = validFile(input.chromePath);
    const extensionPath = validFile(input.extensionPath);
    if (extensionPath && !(await firstExistingDirectory([extensionPath]))) {
      throw new Error(`extensionPath does not exist: ${extensionPath}`);
    }
    const now = new Date().toISOString();
    const profile: BrowserProfile = {
      id,
      name,
      userDataDir,
      ...(chromePath ? { chromePath } : {}),
      ...(extensionPath ? { extensionPath } : {}),
      launchArgs: normalizeLaunchArgs(input.launchArgs),
      createdAt: now,
      updatedAt: now,
    };
    profiles.push(profile);
    await this.save();
    return this.status(profile);
  }

  async launch(profileId: string): Promise<BrowserProfileStatus> {
    const profile = (await this.load()).find((item) => item.id === profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    const existing = this.running.get(profileId);
    if (existing) return this.status(profile);
    if (this.starting.has(profileId)) throw new Error(`Profile is already starting: ${profileId}`);

    this.starting.add(profileId);
    let child: ChildProcess | undefined;
    try {
      await fs.mkdir(profile.userDataDir, { recursive: true });
      const executable = await resolveChromePath(profile.chromePath);
      const cdpPort = await reservePort();
      const extensionPath =
        profile.extensionPath || (await firstExistingDirectory(extensionCandidates()));
      const mcpPort = extensionPath ? await reservePort() : undefined;
      const args = [
        `--user-data-dir=${profile.userDataDir}`,
        `--remote-debugging-port=${cdpPort}`,
        '--remote-debugging-address=127.0.0.1',
        '--no-first-run',
        '--no-default-browser-check',
        ...(extensionPath ? [`--load-extension=${extensionPath}`] : []),
        ...profile.launchArgs,
      ];
      const environment = {
        ...process.env,
        ...(mcpPort
          ? {
              CHROME_MCP_PORT: String(mcpPort),
              MCP_HTTP_PORT: String(mcpPort),
              CHROME_MCP_PROFILE_ID: profile.id,
            }
          : {}),
      };
      child = spawn(executable, args, {
        cwd: profile.userDataDir,
        env: environment,
        stdio: 'ignore',
        windowsHide: true,
      });
      const active: RunningProfile = {
        child,
        cdpPort,
        ...(mcpPort ? { mcpPort } : {}),
        extensionLoaded: Boolean(extensionPath),
        mcpReady: false,
        activeCalls: 0,
      };
      this.running.set(profileId, active);
      child.once('exit', () => {
        if (this.running.get(profileId)?.child === child) this.running.delete(profileId);
      });

      const cdpReady = await this.waitForCdp(cdpPort);
      if (!cdpReady) throw new Error('Chrome started but CDP was not ready');
      if (mcpPort) {
        active.mcpReady = await waitForMcp(mcpPort);
        if (active.mcpReady) active.connection = new ProfileMcpConnection(mcpPort);
      }
      return this.status(profile);
    } catch (error) {
      if (child) await this.stopProcess(child);
      this.running.delete(profileId);
      throw error;
    } finally {
      this.starting.delete(profileId);
    }
  }

  async stop(profileId: string): Promise<BrowserProfileStatus> {
    const profile = (await this.load()).find((item) => item.id === profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    const active = this.running.get(profileId);
    if (!active) return this.status(profile);
    await active.connection?.close();
    await this.stopProcess(active.child);
    this.running.delete(profileId);
    return this.status(profile);
  }

  async delete(
    profileId: string,
  ): Promise<{ id: string; userDataDir: string; dataRemoved: false }> {
    const profiles = await this.load();
    const index = profiles.findIndex((profile) => profile.id === profileId);
    if (index < 0) throw new Error(`Profile not found: ${profileId}`);
    const profile = profiles[index];
    await this.stop(profileId);
    profiles.splice(index, 1);
    await this.save();
    return { id: profile.id, userDataDir: profile.userDataDir, dataRemoved: false };
  }

  async callTool(
    profileId: string,
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<CallToolResult> {
    const profile = (await this.load()).find((item) => item.id === profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    const active =
      this.running.get(profileId) || (await this.launch(profileId), this.running.get(profileId));
    if (!active?.mcpPort || !active.mcpReady) {
      throw new Error(
        `Profile ${profileId} is running without the Chrome MCP extension. Set CHROME_MCP_EXTENSION_PATH or rebuild the extension.`,
      );
    }
    active.connection ||= new ProfileMcpConnection(active.mcpPort);
    active.activeCalls++;
    try {
      return await active.connection.callTool(name, args, signal);
    } finally {
      active.activeCalls--;
    }
  }

  async stopAll(): Promise<void> {
    for (const profileId of [...this.running.keys()]) {
      await this.stop(profileId).catch(() => undefined);
    }
  }

  async summary(): Promise<{ total: number; running: number; profiles: BrowserProfileStatus[] }> {
    const profiles = await this.list();
    return {
      total: profiles.length,
      running: profiles.filter((profile) => profile.status === 'running').length,
      profiles,
    };
  }

  async diagnostics(profileId: string): Promise<BrowserProfileDiagnostics> {
    const profile = (await this.load()).find((item) => item.id === profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    const status = this.status(profile);
    const active = this.running.get(profileId);
    const errors: string[] = [];
    if (!active?.mcpPort) return { profile: status, cdp: null, server: null, proxy: null, errors };

    const server = await fetchJson(`http://127.0.0.1:${active.mcpPort}/status`);
    const cdp = status.cdpUrl ? await fetchJson(`${status.cdpUrl}/json/version`) : null;
    let proxy: unknown = null;
    if (!active.mcpReady) {
      errors.push('Chrome MCP extension is not ready');
    } else {
      try {
        active.connection ||= new ProfileMcpConnection(active.mcpPort);
        proxy = parseToolJson(
          await active.connection.callTool('chrome_proxy_diagnostics', { testConnection: false }),
        );
      } catch (error) {
        errors.push(
          `Proxy diagnostics failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (!server) errors.push('Profile MCP status endpoint is unavailable');
    if (!cdp) errors.push('Chrome DevTools Protocol endpoint is unavailable');
    return { profile: status, cdp, server, proxy, errors };
  }

  private async waitForCdp(port: number, timeoutMs = 10_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await fetchJson(`http://127.0.0.1:${port}/json/version`)) return true;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return false;
  }

  private async stopProcess(child: ChildProcess): Promise<void> {
    if (!child.pid || child.exitCode !== null) return;
    if (process.platform === 'win32') {
      await execFileAsync('taskkill', ['/PID', String(child.pid), '/T', '/F']).catch(
        () => undefined,
      );
      return;
    }
    child.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}

export const browserProfileManager = new BrowserProfileManager();
