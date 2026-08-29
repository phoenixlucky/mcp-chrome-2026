'use strict';

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const childProcess = require('node:child_process');
const { createHash } = require('node:crypto');
const { getAsset } = require('node:sea');

let bundle;
const stdioLaunch = process.argv.some((argument) => argument === '--stdio' || argument === '--mcp-stdio');
const nativeMessagingLaunch = process.argv.some(
  (argument) => argument.startsWith('chrome-extension://') || argument === '--parent-window=0',
);
// Explorer launches have no TTY. Native Messaging launches are identifiable by
// Chrome's extension-origin argument, so a no-argument launch is the user-facing
// service mode even when it came from a desktop shortcut or double-click.
const standaloneLaunch = !stdioLaunch && !nativeMessagingLaunch && process.argv.length <= 2;
const defaultConfig = {
  version: '2.4.10',
  payloadRevision: '2026-08-29-4',
  extensionId: 'djclnaepokchbblcnepfempfdhejjdml',
  hostName: 'com.chromemcp.nativehost',
  port: 12306,
};

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function dataRoot() {
  return process.env.LOCALAPPDATA || process.env.TEMP || os.tmpdir();
}

function logPath() {
  return path.join(dataRoot(), 'mcp-chrome-bridge', 'logs', 'portable-launcher.log');
}

function canRun(command, args) {
  try {
    childProcess.execFileSync(command, args, { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
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

  if (process.platform !== 'win32') failures.push('当前系统不是 Windows。');
  if (process.arch !== 'x64') failures.push(`当前架构为 ${process.arch}，此文件只支持 Windows x64。`);

  const localAppData = dataRoot();
  try {
    fs.mkdirSync(path.join(localAppData, 'mcp-chrome-bridge'), { recursive: true });
    const probePath = path.join(localAppData, 'mcp-chrome-bridge', `.write-test-${process.pid}`);
    fs.writeFileSync(probePath, 'ok', 'utf8');
    fs.rmSync(probePath, { force: true });
  } catch (error) {
    failures.push(`本地应用数据目录不可写：${localAppData}（${error.message}）`);
  }

  const hasTar = canRun('tar.exe', ['--version']);
  const hasPowerShell = canRun('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'exit 0']);
  if (!hasTar && !hasPowerShell) failures.push('系统中没有可用的 tar.exe 或 PowerShell，无法解压内嵌运行时。');
  if (!process.env.APPDATA) warnings.push('未找到 APPDATA，Chrome Native Messaging 注册可能需要手动配置。');

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
        finish(new Error(`等待 MCP HTTP 服务就绪超时（http://127.0.0.1:${port}/mcp）。请先启动独立版 EXE，或检查端口是否被其他程序占用。`));
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
    const content = fs.readFileSync(lockPath, 'utf8').trim().split(/\s+/);
    const pid = Number.parseInt(content[0], 10);
    return { pid, ageMs: Math.max(0, Date.now() - stat.mtimeMs) };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    return { pid: 0, ageMs: Number.POSITIVE_INFINITY };
  }
}

function recoverStaleExtractionLock(lockPath) {
  const info = getLockInfo(lockPath);
  if (!info) return true;

  const stale = info.pid > 0 ? !isProcessAlive(info.pid) : info.ageMs > 60_000;
  if (!stale) return false;

  try {
    fs.rmSync(lockPath, { force: true });
    writeLog(`已清理残留运行时解压锁：${lockPath}（pid=${info.pid || 'unknown'}）`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return true;
    return false;
  }
}

function waitForExtractionLock(lockPath, markerPath) {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(fd, `${process.pid}\n${Date.now()}`);
      return fd;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (fs.existsSync(markerPath)) return null;
      recoverStaleExtractionLock(lockPath);
      sleep(100);
    }
  }
  const info = getLockInfo(lockPath);
  const owner = info?.pid ? `持锁进程 PID=${info.pid}（${isProcessAlive(info.pid) ? '仍在运行' : '已退出'}）` : '无法读取持锁进程信息';
  throw new Error(`等待运行时解压锁超时：${lockPath}；${owner}。请关闭残留的 Chrome MCP Bridge 进程后重试。`);
}

function extractPayload() {
  const localAppData = dataRoot();
  if (!bundle) throw new Error('内嵌运行时资源无法读取，EXE 文件可能已损坏。');

  // A version-only cache key can keep an older payload forever when an EXE is
  // rebuilt without changing the public package version. Include the embedded
  // bundle hash so every changed binary gets a fresh extraction directory.
  const bundleHash = createHash('sha256').update(bundle).digest('hex').slice(0, 12);

  const root = path.join(
    localAppData,
    'mcp-chrome-bridge',
    'portable',
    `${defaultConfig.version}-${defaultConfig.payloadRevision}-${bundleHash}`,
  );
  const markerPath = path.join(root, '.complete');
  const lockPath = `${root}.lock`;
  if (fs.existsSync(markerPath)) return root;

  fs.mkdirSync(path.dirname(root), { recursive: true });
  const lockFd = waitForExtractionLock(lockPath, markerPath);
  if (lockFd === null) return root;

  const temporaryRoot = `${root}.tmp-${process.pid}`;
  const temporaryZip = path.join(path.dirname(root), `bundle-${process.pid}.zip`);
  try {
    if (fs.existsSync(temporaryRoot)) fs.rmSync(temporaryRoot, { recursive: true, force: true });
    fs.mkdirSync(temporaryRoot, { recursive: true });
    fs.writeFileSync(temporaryZip, bundle);

    let tarError;
    try {
      childProcess.execFileSync('tar.exe', ['-xf', temporaryZip, '-C', temporaryRoot], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch (error) {
      tarError = error;
      const escapedZip = temporaryZip.replaceAll("'", "''");
      const escapedDestination = temporaryRoot.replaceAll("'", "''");
      try {
        childProcess.execFileSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDestination}' -Force`,
          ],
          { stdio: 'ignore', windowsHide: true },
        );
      } catch (powershellError) {
        throw new Error(
          `运行时解压失败。tar.exe：${tarError.message}；PowerShell：${powershellError.message}`,
        );
      }
    }

    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
    fs.renameSync(temporaryRoot, root);
    fs.writeFileSync(markerPath, defaultConfig.version, 'utf8');
    return root;
  } finally {
    if (fs.existsSync(temporaryZip)) fs.rmSync(temporaryZip, { force: true });
    if (fs.existsSync(temporaryRoot)) fs.rmSync(temporaryRoot, { recursive: true, force: true });
    try { fs.closeSync(lockFd); } catch {}
    try { fs.rmSync(lockPath, { force: true }); } catch {}
  }
}

function registerNativeMessagingHost(config) {
  const executablePath = process.execPath;
  const appData = process.env.APPDATA;
  if (!appData) return ['未找到 APPDATA，已跳过 Chrome Native Messaging 注册。'];
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
      const message = `Native Messaging 注册 ${browser} 失败：${error.message}`;
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
    throw new Error(`内嵌运行时文件不完整，缺少：${missing.map((filePath) => path.relative(payloadRoot, filePath)).join('、')}`);
  }

  const entryPath = path.join(payloadRoot, 'app', 'native-server', 'dist', 'index.js');
  const requireFromEntry = createRequire(entryPath);
  try {
    requireFromEntry('better-sqlite3');
  } catch (error) {
    throw new Error(`关键原生依赖 better-sqlite3 加载失败（${process.arch}）：${error.message}`);
  }
  return entryPath;
}

function getStdioEntry(payloadRoot) {
  const entryPath = path.join(payloadRoot, 'app', 'native-server', 'dist', 'mcp', 'mcp-server-stdio.js');
  if (!fs.existsSync(entryPath)) {
    throw new Error('内嵌运行时不包含 MCP stdio 入口文件，请重新下载完整 EXE。');
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
  embeddedServerChild.once('error', (error) => writeLog(`MCP stdio 内嵌 HTTP 服务启动失败：${error.message}`));
  embeddedServerChild.once('exit', (code, signal) => {
    if (!embeddedServerChild) return;
    if (code !== 0 && signal === null) {
      writeLog(`MCP stdio 内嵌 HTTP 服务提前退出：code=${code}`);
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
      `扩展 ID：${config.extensionId}`,
      `Native Messaging 主机：${config.hostName}`,
      `服务地址：http://127.0.0.1:${port}`,
      '',
    ].join('\n'),
  );
}

function waitForUserBeforeExit() {
  if (!standaloneLaunch) return;
  process.stderr.write('\n按 Enter 退出...\n');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(1));
}

if (standaloneLaunch) process.env.CHROME_MCP_STANDALONE = '1';

(async () => {
  try {
    bundle = Buffer.from(getAsset('chrome-mcp-bundle.zip'));

    const environment = runEnvironmentChecks();
    if (environment.failures.length > 0) {
      throw new Error(`启动前环境检查失败：\n${environment.failures.join('\n')}`);
    }

    const payloadRoot = extractPayload();
    const config = readConfig(payloadRoot);
    const portValue = process.env.CHROME_MCP_PORT || process.env.MCP_HTTP_PORT;
    const configuredPort = Number.parseInt(portValue || config.port || defaultConfig.port, 10);
    const port = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535
      ? configuredPort
      : defaultConfig.port;
    const portStatus = await checkPort(port);
    const warnings = [...environment.warnings];
    if (!portStatus.available) {
      warnings.push(`端口 ${port} 当前已被占用，可能已有服务在运行；如果 Chrome 仍无法连接，请先关闭占用该端口的程序。`);
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
        `服务仍会尝试启动。诊断日志：${logPath()}`,
      ].join('\n');
      writeLog(`启动前提醒：\n${warningText}`);
      showWindowsMessage('Chrome MCP Bridge 环境提醒', warningText, 'Warning');
    }

    createRequire(entryPath)(entryPath);
  } catch (error) {
    const detail = formatError(error);
    const fullError = error && error.stack ? error.stack : detail;
    const userMessage = [
      detail,
      '',
      `系统：${process.platform} ${process.arch}`,
      `Node：${process.version}`,
      `日志：${logPath()}`,
    ].join('\n');
    process.stderr.write(`Chrome MCP Bridge 启动失败：${fullError}\n`);
    writeLog(`启动失败：\n${fullError}\n环境：${userMessage}`);
    showWindowsMessage('Chrome MCP Bridge 启动失败', userMessage);
    if (standaloneLaunch) waitForUserBeforeExit();
    else process.exitCode = 1;
  }
})();
