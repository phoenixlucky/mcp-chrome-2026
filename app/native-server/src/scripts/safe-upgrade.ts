import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PACKAGE_JSON = path.resolve(__dirname, '../../package.json');

interface NpmMetadata {
  version?: string;
  dist?: { tarball?: string; integrity?: string };
}

export function isExactVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value.trim());
}

export function verifyIntegrity(data: Buffer, integrity: string): boolean {
  const match = /^sha512-(.+)$/.exec(integrity.trim());
  if (!match) return false;
  const actual = createHash('sha512').update(data).digest('base64');
  return actual === match[1];
}

function npmExecutable(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function npmMetadata(packageName: string, version: string): Promise<NpmMetadata> {
  const { stdout } = await execFileAsync(npmExecutable(), [
    'view',
    `${packageName}@${version}`,
    'version',
    'dist.tarball',
    'dist.integrity',
    '--json',
  ]);
  const value = JSON.parse(stdout) as NpmMetadata;
  if (value.version !== version || !value.dist?.tarball || !value.dist.integrity) {
    throw new Error('npm metadata is missing an exact version, tarball, or integrity hash');
  }
  return value;
}

async function installTarball(tarball: string): Promise<void> {
  await execFileAsync(npmExecutable(), ['install', '--global', tarball], {
    maxBuffer: 4 * 1024 * 1024,
  });
}

function packageInfo(): { name: string; version: string } {
  const pkg = JSON.parse(require('node:fs').readFileSync(PACKAGE_JSON, 'utf8')) as {
    name?: string;
    version?: string;
  };
  if (!pkg.name || !pkg.version) throw new Error('package.json is missing name or version');
  return { name: pkg.name, version: pkg.version };
}

async function validateInstalled(version: string): Promise<void> {
  const root = path.resolve(__dirname, '..');
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')) as {
    version?: string;
  };
  const required = [
    path.join(root, 'index.js'),
    path.join(root, 'cli.js'),
    path.join(root, 'run_host.bat'),
    path.join(root, 'vendor', 'chrome-mcp-shared-2026', 'dist', 'index.js'),
  ];
  if (pkg.version !== version || required.some((file) => !require('node:fs').existsSync(file))) {
    throw new Error('installed package failed post-upgrade validation');
  }
}

export async function safeUpgrade(version: string, dryRun = false): Promise<void> {
  const target = version.trim();
  if (!isExactVersion(target))
    throw new Error('upgrade requires an exact semantic version, e.g. 2.2.2');
  const current = packageInfo();
  if (current.version === target) throw new Error(`Already running ${target}`);

  const metadata = await npmMetadata(current.name, target);
  const response = await fetch(metadata.dist!.tarball!, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`failed to download upgrade tarball: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (!verifyIntegrity(data, metadata.dist!.integrity!)) {
    throw new Error('upgrade tarball integrity verification failed');
  }
  if (dryRun) return;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chrome-mcp-upgrade-'));
  const tarball = path.join(
    tempDir,
    `${current.name.replace(/[^a-z0-9._-]/gi, '-')}-${target}.tgz`,
  );
  await fs.writeFile(tarball, data);
  try {
    await installTarball(tarball);
    try {
      await validateInstalled(target);
    } catch (error) {
      await execFileAsync(
        npmExecutable(),
        ['install', '--global', `${current.name}@${current.version}`],
        {
          maxBuffer: 4 * 1024 * 1024,
        },
      ).catch((rollbackError) => {
        throw new Error(
          `${error instanceof Error ? error.message : String(error)}; rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
        );
      });
      throw error;
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
