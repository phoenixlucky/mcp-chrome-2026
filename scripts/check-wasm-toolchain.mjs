import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const isWindows = process.platform === 'win32';
const pathSeparator = isWindows ? ';' : ':';
const cargoHome = process.env.CARGO_HOME || join(homedir(), '.cargo');
const cargoBin = join(cargoHome, 'bin');
const toolEnv = {
  ...process.env,
  PATH: `${cargoBin}${pathSeparator}${process.env.PATH || ''}`,
};

function getLocalCommand(command) {
  const candidates = isWindows ? [`${command}.exe`, command] : [command];
  return candidates.map((name) => join(cargoBin, name)).find(existsSync) || command;
}

function commandExists(command) {
  return spawnSync(getLocalCommand(command), ['--version'], {
    env: toolEnv,
    stdio: 'ignore',
  }).status === 0;
}

function run(command, args) {
  return spawnSync(getLocalCommand(command), args, {
    env: toolEnv,
    stdio: 'inherit',
  });
}

async function installRust() {
  const architecture = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
  const installerUrl = isWindows
    ? `https://win.rustup.rs/${architecture}`
    : 'https://sh.rustup.rs';
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'mcp-wasm-rustup-'));
  const installerPath = join(temporaryDirectory, isWindows ? 'rustup-init.exe' : 'rustup-init.sh');

  try {
    console.error('未找到 Rust/cargo，正在下载并安装官方 Rust toolchain...');
    const response = await fetch(installerUrl);
    if (!response.ok) {
      throw new Error(`下载 rustup 失败：HTTP ${response.status}`);
    }
    await writeFile(installerPath, Buffer.from(await response.arrayBuffer()));

    const args = ['-y', '--default-toolchain', 'stable', '--profile', 'minimal'];
    const result = isWindows
      ? spawnSync(installerPath, args, { env: toolEnv, stdio: 'inherit' })
      : spawnSync('sh', [installerPath, ...args], { env: toolEnv, stdio: 'inherit' });

    if (result.status !== 0) {
      throw new Error('rustup 安装失败');
    }
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

function ensureWasmTarget() {
  if (!commandExists('rustup')) return;

  const installedTargets = spawnSync(getLocalCommand('rustup'), ['target', 'list', '--installed'], {
    encoding: 'utf8',
    env: toolEnv,
  });
  if (installedTargets.status === 0 && installedTargets.stdout.includes('wasm32-unknown-unknown')) {
    return;
  }

  console.error('正在安装 Rust WASM target wasm32-unknown-unknown...');
  const result = run('rustup', ['target', 'add', 'wasm32-unknown-unknown']);
  if (result.status !== 0) {
    throw new Error('Rust WASM target 安装失败');
  }
}

async function main() {
  if (commandExists('wasm-pack')) {
    if (process.argv[2] === 'run') {
      const result = spawnSync(getLocalCommand('wasm-pack'), process.argv.slice(3), {
        env: toolEnv,
        stdio: 'inherit',
      });
      process.exit(result.status ?? 1);
    }
    return;
  }

  if (!commandExists('cargo')) {
    await installRust();
  }
  if (!commandExists('cargo')) {
    throw new Error('Rust 安装完成但当前进程找不到 cargo，请重新打开终端后重试');
  }

  ensureWasmTarget();

  console.error('未找到 wasm-pack，正在使用 cargo 自动安装 wasm-pack...');
  const install = run('cargo', ['install', 'wasm-pack', '--locked']);
  if (install.status !== 0 || !commandExists('wasm-pack')) {
    throw new Error('wasm-pack 安装失败，或安装目录不在当前 PATH 中');
  }

  if (process.argv[2] === 'run') {
    const result = spawnSync(getLocalCommand('wasm-pack'), process.argv.slice(3), {
      env: toolEnv,
      stdio: 'inherit',
    });
    process.exit(result.status ?? 1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
