'use strict';

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const childProcess = require('node:child_process');
const stdioLaunch = process.argv.some((argument) => argument === '--stdio' || argument === '--mcp-stdio');
const nativeMessagingLaunch = process.argv.some(
  (argument) => argument.startsWith('chrome-extension://') || argument === '--parent-window=0',
);
// Explorer launches have no TTY. Native Messaging launches are identifiable by
// Chrome's extension-origin argument, so a no-argument launch is the user-facing
// service mode even when it came from a desktop shortcut or double-click.
const standaloneLaunch = !stdioLaunch && !nativeMessagingLaunch && process.argv.length <= 2;
const defaultConfig = {
  version: 'dev',
  extensionId: 'djclnaepokchbblcnepfempfdhejjdml',
  hostName: 'com.chromemcp.nativehost',
  port: 12306,
};

function dataRoot() {
  return process.env.LOCALAPPDATA || process.env.TEMP || os.tmpdir();
}

function logPath() {
  return path.join(dataRoot(), 'mcp-chrome-bridge', 'logs', 'portable-launcher.log');
}

function showWindowsMessage(title, message, icon = 'Error') {
  if (!standaloneLaunch) return;
  try {
    const encode = (value) => Buffer.from(String(value), 'utf8').toString('base64');
    const script = [
      `$message = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encode(message)}'));`,
      `$title = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encode(title)}'));`,
      'Add-Type -AssemblyName System.Windows.Forms;',
      `[Windows.Forms.MessageBox]::Show($message, $title, [Windows.Forms.MessageBoxButtons]::OK, [Windows.Forms.MessageBoxIcon]::${icon}) | Out-Null;`,
    ].join('');
    const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');
    childProcess.spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedCommand],
      { stdio: 'ignore', windowsHide: true },
    );
  } catch {
    // The log and the console pause below remain available if PowerShell is unavailable.
  }
}

function runEnvironmentChecks() {
  const failures = [];
  const warnings = [];

  if (process.platform !== 'win32') failures.push('The current system is not Windows.');
  if (process.arch !== 'x64') failures.push(`Current architecture is ${process.arch}; this file only supports Windows x64.`);

  const localAppData = dataRoot();
  try {
    fs.mkdirSync(path.join(localAppData, 'mcp-chrome-bridge'), { recursive: true });
    const probePath = path.join(localAppData, 'mcp-chrome-bridge', `.write-test-${process.pid}`);
    fs.writeFileSync(probePath, 'ok', 'utf8');
    fs.rmSync(probePath, { force: true });
  } catch (error) {
    failures.push(`The local app data directory is not writable: ${localAppData} (${error.message})`);
  }

  if (!process.env.APPDATA) warnings.push('APPDATA was not found; Chrome Native Messaging registration may need manual configuration.');

  return { failures, warnings };
}

function checkPort(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    const finish = (result) => {
      try { probe.close(); } catch {}
      resolve(result);
    };
    probe.once('error', (error) => finish({ available: false, error }));
    probe.listen({ host: '127.0.0.1', port }, () => finish({ available: true }));
  });
}

function waitForHttpServer(port, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };

    const attempt = () => {
      if (settled) return;
      if (Date.now() >= deadline) {
        finish(new Error(`Timed out waiting for the MCP HTTP service to become ready (http://127.0.0.1:${port}/mcp). Start the standalone EXE first, or check whether another program is using the port.`));
        return;
      }

      const request = http.get(
        { hostname: '127.0.0.1', port, path: '/ping', timeout: 1_000 },
        (response) => {
          response.resume();
          if (response.statusCode === 200) {
            finish();
            return;
          }
          setTimeout(attempt, 250);
        },
      );
      request.on('timeout', () => request.destroy());
      request.on('error', () => setTimeout(attempt, 250));
    };

    attempt();
  });
}

function readConfig(root) {
  const configPath = path.join(root, 'payload-config.json');
  if (!fs.existsSync(configPath)) return defaultConfig;
  return { ...defaultConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
}

function extractPayload() {
  const root = process.env.CHROME_MCP_PAYLOAD_ROOT;
  if (!root || !fs.existsSync(path.join(root, '.complete'))) {
    throw new Error('The portable launcher did not provide a valid runtime cache directory.');
  }
  return root;
}

function registerNativeMessagingHost(config) {
  const executablePath = process.env.CHROME_MCP_LAUNCHER_PATH || process.execPath;
  const appData = process.env.APPDATA;
  if (!appData) return ['APPDATA was not found; skipped Chrome Native Messaging registration.'];
  const warnings = [];

  const manifest = JSON.stringify(
    {
      name: config.hostName,
      description: 'Chrome MCP Bridge native host',
      path: executablePath,
      type: 'stdio',
      allowed_origins: [`chrome-extension://${config.extensionId}/`],
    },
    null,
    2,
  );

  for (const browser of ['Google\\Chrome', 'Chromium']) {
    try {
      const manifestDirectory = path.join(appData, browser, 'NativeMessagingHosts');
      fs.mkdirSync(manifestDirectory, { recursive: true });
      const manifestPath = path.join(manifestDirectory, `${config.hostName}.json`);
      fs.writeFileSync(manifestPath, manifest, 'utf8');
      const registryKey = `HKCU\\Software\\${browser}\\NativeMessagingHosts\\${config.hostName}`;
      childProcess.execFileSync('reg.exe', ['add', registryKey, '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch (error) {
      const message = `Failed to register Native Messaging for ${browser}: ${error.message}`;
      warnings.push(message);
      writeLog(message);
    }
  }
  return warnings;
}

function writeLog(message) {
  try {
    const logDirectory = path.dirname(logPath());
    fs.mkdirSync(logDirectory, { recursive: true });
    fs.appendFileSync(logPath(), `[${new Date().toISOString()}] ${message}\n`);
  } catch {}
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === 'EPERM';
  }
}

function getLockInfo(lockPath) {
  try {
    const stat = fs.statSync(lockPath);
    const pid = Number.parseInt(fs.readFileSync(lockPath, 'utf8').trim().split(/\s+/)[0], 10);
    return { pid, ageMs: Math.max(0, Date.now() - stat.mtimeMs) };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    return { pid: 0, ageMs: Number.POSITIVE_INFINITY };
  }
}

function managerLockPath() {
  return path.join(dataRoot(), 'mcp-chrome-bridge', 'desktop-manager.lock');
}

function acquireManagerLock() {
  const lockPath = managerLockPath();
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(fd, `${process.pid}\n${Date.now()}`);
      return { fd, lockPath };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const info = getLockInfo(lockPath);
      if (info?.pid && isProcessAlive(info.pid)) return null;
      try { fs.rmSync(lockPath, { force: true }); } catch {}
    }
  }
  return null;
}

function releaseManagerLock(lock) {
  if (!lock) return;
  try { fs.closeSync(lock.fd); } catch {}
  try { fs.rmSync(lock.lockPath, { force: true }); } catch {}
}

function launchDesktopManager(config, port, payloadRoot) {
  const lock = acquireManagerLock();
  if (!lock) {
    showWindowsMessage(
      'Chrome MCP Bridge',
      'The client is already running. Open the existing window from the system tray instead of starting it again.',
      'Information',
    );
    return null;
  }

  const uiDirectory = path.join(dataRoot(), 'mcp-chrome-bridge', 'ui');
  const uiScriptPath = path.join(uiDirectory, `desktop-ui-${config.version}.ps1`);
  const iconPath = path.join(uiDirectory, 'chrome-mcp-icon.ico');
  try {
    fs.mkdirSync(uiDirectory, { recursive: true });
    const script = fs.readFileSync(path.join(payloadRoot, 'desktop-ui.ps1'));
    const icon = fs.readFileSync(path.join(payloadRoot, 'chrome-mcp-icon.ico'));
    // Windows PowerShell 5.1 needs a UTF-8 BOM to read non-ASCII UI text.
    fs.writeFileSync(uiScriptPath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), script]));
    fs.writeFileSync(iconPath, icon);
    const uiProcess = childProcess.spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-STA',
        '-WindowStyle',
        'Hidden',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        uiScriptPath,
        '-Port',
        String(port),
        '-Version',
        String(config.version),
        '-ExtensionId',
        String(config.extensionId),
        '-HostName',
        String(config.hostName),
        '-IconPath',
        iconPath,
        '-LogPath',
        logPath(),
      ],
      // Keep the WinForms window visible. PowerShell's -WindowStyle Hidden
      // hides its console; Node's windowsHide flag would also hide the UI
      // window created by System.Windows.Forms.
      { stdio: 'ignore', windowsHide: false },
    );
    uiProcess.once('error', (error) => {
      writeLog(`Failed to start the desktop manager: ${error.message}`);
      releaseManagerLock(lock);
      try { fs.rmSync(uiScriptPath, { force: true }); } catch {}
      try { fs.rmSync(iconPath, { force: true }); } catch {}
      showWindowsMessage('Chrome MCP Bridge failed to start', `Failed to start the desktop manager: ${error.message}`);
      process.exitCode = 1;
    });
    uiProcess.once('exit', (code) => {
      releaseManagerLock(lock);
      try { fs.rmSync(uiScriptPath, { force: true }); } catch {}
      try { fs.rmSync(iconPath, { force: true }); } catch {}
      process.exit(code === null ? 0 : code);
    });
    return uiProcess;
  } catch (error) {
    releaseManagerLock(lock);
    try { fs.rmSync(uiScriptPath, { force: true }); } catch {}
    try { fs.rmSync(iconPath, { force: true }); } catch {}
    throw error;
  }
}

function validatePayload(payloadRoot) {
  const requiredPaths = [
    path.join(payloadRoot, 'payload-config.json'),
    path.join(payloadRoot, 'node.exe'),
    path.join(payloadRoot, 'app', 'native-server', 'package.json'),
    path.join(payloadRoot, 'app', 'native-server', 'dist', 'index.js'),
    path.join(payloadRoot, 'app', 'chrome-extension', '.output', 'chrome-mv3', 'manifest.json'),
  ];
  const missing = requiredPaths.filter((filePath) => !fs.existsSync(filePath));
  if (missing.length > 0) {
    throw new Error(`The embedded runtime is incomplete; missing: ${missing.map((filePath) => path.relative(payloadRoot, filePath)).join(', ')}`);
  }

  const entryPath = path.join(payloadRoot, 'app', 'native-server', 'dist', 'index.js');
  const requireFromEntry = createRequire(entryPath);
  try {
    requireFromEntry('better-sqlite3');
  } catch (error) {
    throw new Error(`Failed to load the critical native dependency better-sqlite3 (${process.arch}): ${error.message}`);
  }
  return entryPath;
}

function getStdioEntry(payloadRoot) {
  const entryPath = path.join(payloadRoot, 'app', 'native-server', 'dist', 'mcp', 'mcp-server-stdio.js');
  if (!fs.existsSync(entryPath)) {
    throw new Error('The embedded runtime does not contain the MCP stdio entry file; download the full EXE again.');
  }
  return entryPath;
}

let embeddedServerChild;

async function ensureEmbeddedHttpServer(payloadRoot, port, portAvailable) {
  if (!portAvailable) {
    await waitForHttpServer(port, 5_000);
    return;
  }

  const nodePath = path.join(payloadRoot, 'node.exe');
  const serverEntry = path.join(payloadRoot, 'app', 'native-server', 'dist', 'index.js');
  embeddedServerChild = childProcess.spawn(nodePath, [serverEntry], {
    env: {
      ...process.env,
      CHROME_MCP_STANDALONE: '1',
      CHROME_MCP_PORT: String(port),
      MCP_HTTP_PORT: String(port),
    },
    stdio: 'ignore',
    windowsHide: true,
  });
  embeddedServerChild.once('error', (error) => writeLog(`Failed to start the MCP stdio embedded HTTP service: ${error.message}`));
  embeddedServerChild.once('exit', (code, signal) => {
    if (!embeddedServerChild) return;
    if (code !== 0 && signal === null) {
      writeLog(`The MCP stdio embedded HTTP service exited early: code=${code}`);
    }
  });

  try {
    await waitForHttpServer(port);
  } catch (error) {
    try { embeddedServerChild.kill(); } catch {}
    embeddedServerChild = undefined;
    throw error;
  }
}

function stopEmbeddedHttpServer() {
  if (!embeddedServerChild) return;
  try { embeddedServerChild.kill(); } catch {}
  embeddedServerChild = undefined;
}

function formatError(error) {
  return error && typeof error.message === 'string' ? error.message : String(error);
}

function printStartupInfo(config, port) {
  if (!standaloneLaunch) return;
  process.stdout.write(
    [
      `Chrome MCP Bridge ${config.version}`,
      `Extension ID: ${config.extensionId}`,
      `Native Messaging host: ${config.hostName}`,
      `Service URL: http://127.0.0.1:${port}`,
      '',
    ].join('\n'),
  );
}

function waitForUserBeforeExit() {
  if (!standaloneLaunch) return;
  process.stderr.write('\nPress Enter to exit...\n');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(1));
}

if (standaloneLaunch) process.env.CHROME_MCP_STANDALONE = '1';

(async () => {
  try {
    const environment = runEnvironmentChecks();
    if (environment.failures.length > 0) {
      throw new Error(`Pre-launch environment check failed:\n${environment.failures.join('\n')}`);
    }

    const payloadRoot = extractPayload();
    if (process.argv.includes('--validate-payload')) {
      validatePayload(payloadRoot);
      return;
    }
    const config = readConfig(payloadRoot);
    const portValue = process.env.CHROME_MCP_PORT || process.env.MCP_HTTP_PORT;
    const configuredPort = Number.parseInt(portValue || config.port || defaultConfig.port, 10);
    const port = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535
      ? configuredPort
      : defaultConfig.port;
    const portStatus = await checkPort(port);
    const warnings = [...environment.warnings];
    if (!portStatus.available) {
      warnings.push(`Port ${port} is already in use; a service may already be running. If Chrome still cannot connect, close the program occupying the port first.`);
    }
    warnings.push(...registerNativeMessagingHost(config));

    const entryPath = validatePayload(payloadRoot);
    if (stdioLaunch) {
      const stdioEntryPath = getStdioEntry(payloadRoot);
      await ensureEmbeddedHttpServer(payloadRoot, port, portStatus.available);
      if (!process.env.MCP_SERVER_URL) {
        process.env.MCP_SERVER_URL = `http://127.0.0.1:${port}/mcp`;
      }
      process.once('exit', stopEmbeddedHttpServer);
      createRequire(stdioEntryPath)(stdioEntryPath);
      return;
    }
    printStartupInfo(config, port);
    if (warnings.length > 0) {
      const warningText = [
        ...warnings,
        '',
        `The service will still try to start. Diagnostic log: ${logPath()}`,
      ].join('\n');
      writeLog(`Pre-launch warnings:\n${warningText}`);
      // The desktop manager displays warnings in its status panel. A modal
      // message box here would block the manager whenever Native Host already
      // owns the expected port, which is the normal Chrome-connected state.
      if (!standaloneLaunch) showWindowsMessage('Chrome MCP Bridge environment warning', warningText, 'Warning');
    }

    if (standaloneLaunch) {
      launchDesktopManager(config, port, payloadRoot);
      return;
    }

    createRequire(entryPath)(entryPath);
  } catch (error) {
    const detail = formatError(error);
    const fullError = error && error.stack ? error.stack : detail;
    const userMessage = [
      detail,
      '',
      `System: ${process.platform} ${process.arch}`,
      `Node: ${process.version}`,
      `Log: ${logPath()}`,
    ].join('\n');
    process.stderr.write(`Chrome MCP Bridge failed to start: ${fullError}\n`);
    writeLog(`Startup failed:\n${fullError}\nEnvironment: ${userMessage}`);
    showWindowsMessage('Chrome MCP Bridge failed to start', userMessage);
    if (standaloneLaunch) waitForUserBeforeExit();
    else process.exitCode = 1;
  }
})();
