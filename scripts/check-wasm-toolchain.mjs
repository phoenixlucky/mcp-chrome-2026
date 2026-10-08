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
    console.error('Rust/cargo not found; downloading and installing the official Rust toolchain...');
    const response = await fetch(installerUrl);
    if (!response.ok) {
      throw new Error(`Failed to download rustup: HTTP ${response.status}`);
    }
    await writeFile(installerPath, Buffer.from(await response.arrayBuffer()));

    const args = ['-y', '--default-toolchain', 'stable', '--profile', 'minimal'];
    const result = isWindows
      ? spawnSync(installerPath, args, { env: toolEnv, stdio: 'inherit' })
      : spawnSync('sh', [installerPath, ...args], { env: toolEnv, stdio: 'inherit' });

    if (result.status !== 0) {
      throw new Error('rustup installation failed');
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

  console.error('Installing the Rust WASM target wasm32-unknown-unknown...');
  const result = run('rustup', ['target', 'add', 'wasm32-unknown-unknown']);
  if (result.status !== 0) {
    throw new Error('Rust WASM target installation failed');
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
    throw new Error('Rust is installed but cargo is not visible to this process; reopen the terminal and retry');
  }

  ensureWasmTarget();

  console.error('wasm-pack not found; installing wasm-pack with cargo...');
  const install = run('cargo', ['install', 'wasm-pack', '--locked']);
  if (install.status !== 0 || !commandExists('wasm-pack')) {
    throw new Error('wasm-pack installation failed, or its install directory is not on the current PATH');
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
