import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { promises as fs, existsSync, realpathSync, readFileSync, lstatSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const skipBuild = process.argv.includes('--skip-build');
const releaseDir = path.join(root, 'releases');
const stageDir = path.join(releaseDir, `.windows-stage-${version}-${process.pid}`);
const payloadDir = path.join(stageDir, 'payload');
const bundleZip = path.join(stageDir, `chrome-mcp-bundle-${version}.zip`);
const seaConfigPath = path.join(stageDir, 'sea-config.json');
const seaBlobPath = path.join(stageDir, 'sea-prep.blob');
const seaStubPath = path.join(stageDir, 'ChromeMcpBridge.exe');
const outputExe = path.join(releaseDir, `chrome-mcp-bridge-${version}-win-x64.exe`);

function run(command, args) {
  console.log(`> ${command} ${args.join(' ')}`);
  if (command.toLowerCase().endsWith('.cmd')) {
    const quote = (value) => {
      const text = String(value);
      return /[\s"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    execFileSync('cmd.exe', ['/d', '/c', [command, ...args].map(quote).join(' ')], {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
    });
    return;
  }
  execFileSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true });
}

function extensionIdFromManifest(manifestPath) {
  const manifest = JSON.parse(requireFile(manifestPath));
  if (typeof manifest.key !== 'string') return 'djclnaepokchbblcnepfempfdhejjdml';
  return createHash('sha256')
    .update(Buffer.from(manifest.key, 'base64'))
    .digest('hex')
    .slice(0, 32)
    .replace(/[0-9a-f]/g, (digit) => String.fromCharCode(97 + Number.parseInt(digit, 16)));
}

function requireFile(filePath) {
  return readFileSync(filePath, 'utf8');
}

async function copyPackageFiles(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    // Package documentation is not needed at runtime. Skipping it also avoids
    // copying locked/read-protected license files from some pnpm stores.
    if (
      entry.name.startsWith('.') ||
      /^(README|LICENSE|CHANGELOG|eslint|prettier|tsconfig|vitest|jest|rollup|webpack|babel)(\.|$)/i.test(entry.name) ||
      /\.(map|d\.ts)$/i.test(entry.name)
    ) continue;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      await copyPackageFiles(sourcePath, destinationPath);
    } else {
      const actualPath = entry.isSymbolicLink() ? realpathSync(sourcePath) : sourcePath;
      const actualStat = lstatSync(actualPath);
      if (actualStat.isDirectory()) await copyPackageFiles(actualPath, destinationPath);
      else await fs.copyFile(actualPath, destinationPath);
    }
  }
}

function packageRootFromFile(filePath) {
  let current = path.dirname(filePath);
  while (current !== path.dirname(current)) {
    const packageJsonPath = path.join(current, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageData = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        if (typeof packageData.name === 'string' && packageData.name) return realpathSync(current);
      } catch {
        // Continue walking if this is a package-local configuration file.
      }
    }
    current = path.dirname(current);
  }
  return undefined;
}

function resolveDependencyRoot(packageRoot, dependencyName) {
  try {
    const resolver = createRequire(path.join(packageRoot, 'package.json'));
    return packageRootFromFile(resolver.resolve(dependencyName));
  } catch {
    return undefined;
  }
}

async function collectPackageGraph(sourceRoots) {
  const graph = new Map();
  const visit = async (sourceRoot) => {
    const packageRoot = realpathSync(sourceRoot);
    const packageData = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    const key = `${packageData.name}@${packageData.version}`;
    if (graph.has(key)) return graph.get(key);

    const node = { key, name: packageData.name, version: packageData.version, root: packageRoot, dependencies: new Map() };
    graph.set(key, node);
    const dependencyNames = new Set([
      ...Object.keys(packageData.dependencies ?? {}),
      ...Object.keys(packageData.optionalDependencies ?? {}),
      ...Object.keys(packageData.peerDependencies ?? {}),
    ]);
    for (const dependencyName of dependencyNames) {
      const dependencyRoot = resolveDependencyRoot(packageRoot, dependencyName);
      if (!dependencyRoot) continue;
      const dependency = await visit(dependencyRoot);
      node.dependencies.set(dependencyName, dependency.key);
    }
    return node;
  };

  for (const sourceRoot of sourceRoots) await visit(sourceRoot);
  return graph;
}

async function materializePackageNode(node, destination, graph, rootChoices, active = new Set()) {
  if (active.has(node.key)) return;
  active.add(node.key);
  await copyPackageFiles(node.root, destination);
  for (const [dependencyName, dependencyKey] of node.dependencies) {
    if (rootChoices.get(dependencyName) === dependencyKey) continue;
    const dependency = graph.get(dependencyKey);
    if (dependency) {
      await materializePackageNode(dependency, path.join(destination, 'node_modules', dependencyName), graph, rootChoices, active);
    }
  }
  active.delete(node.key);
}

async function removeMatching(directory, predicate) {
  if (!existsSync(directory)) return;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (predicate(entryPath, entry)) {
      await fs.rm(entryPath, { recursive: true, force: true });
    } else if (entry.isDirectory() && !entry.isSymbolicLink()) {
      await removeMatching(entryPath, predicate);
    }
  }
}

async function main() {
  if (process.platform !== 'win32') throw new Error('Windows EXE packaging must run on Windows.');
  if (!skipBuild) {
    run('pnpm.cmd', ['run', 'build:native']);
    run('pnpm.cmd', ['run', 'build:extension']);
  }

  await fs.rm(stageDir, { recursive: true, force: true });
  await fs.mkdir(payloadDir, { recursive: true });
  await fs.mkdir(releaseDir, { recursive: true });

  const nativeDir = path.join(root, 'app', 'native-server');
  const nativeDist = path.join(nativeDir, 'dist');
  const extensionDist = path.join(root, 'app', 'chrome-extension', '.output', 'chrome-mv3');
  const iconSource = path.join(root, 'app', 'chrome-extension', 'public', 'icon', 'catgirl.ico');
  const sourceNodeModules = path.join(nativeDir, 'node_modules');
  const stageNativeDir = path.join(payloadDir, 'app', 'native-server');
  const stageNodeModules = path.join(stageNativeDir, 'node_modules');

  if (!existsSync(nativeDist)) throw new Error('Native server dist is missing.');
  if (!existsSync(extensionDist)) throw new Error('Chrome extension build output is missing.');
  if (!existsSync(iconSource)) throw new Error('Catgirl icon asset is missing.');
  if (!existsSync(sourceNodeModules)) throw new Error('Native server dependencies are missing.');

  await fs.copyFile(process.execPath, path.join(payloadDir, 'node.exe'));
  await fs.cp(nativeDist, path.join(stageNativeDir, 'dist'), { recursive: true });
  await fs.copyFile(path.join(nativeDir, 'package.json'), path.join(stageNativeDir, 'package.json'));
  await fs.cp(extensionDist, path.join(payloadDir, 'app', 'chrome-extension', '.output', 'chrome-mv3'), { recursive: true });

  const nativePackage = JSON.parse(await fs.readFile(path.join(nativeDir, 'package.json'), 'utf8'));
  const dependencyRoots = [];
  for (const dependencyName of Object.keys(nativePackage.dependencies ?? {})) {
    const sourceDependency = path.join(sourceNodeModules, dependencyName);
    if (!existsSync(sourceDependency)) throw new Error(`Missing dependency: ${dependencyName}`);
    dependencyRoots.push(realpathSync(sourceDependency));
  }

  const graph = await collectPackageGraph(dependencyRoots);
  const rootChoices = new Map();
  for (const node of graph.values()) {
    if (!rootChoices.has(node.name)) rootChoices.set(node.name, node.key);
  }
  for (const node of graph.values()) {
    if (typeof node.name !== 'string' || !node.name) throw new Error(`Package metadata missing name: ${node.root}`);
    if (rootChoices.get(node.name) === node.key) {
      await materializePackageNode(node, path.join(stageNodeModules, node.name), graph, rootChoices);
    }
  }

  const sharedSource = path.join(nativeDist, 'vendor', 'chrome-mcp-shared-2026');
  if (existsSync(sharedSource)) {
    await fs.cp(sharedSource, path.join(stageNodeModules, '@ethanwilkins', 'chrome-mcp-shared-2026'), { recursive: true });
  }

  await removeMatching(path.join(stageNativeDir, 'dist'), (entryPath, entry) =>
    entry.isFile() && /\.(d\.ts|map)$/i.test(entry.name),
  );
  await removeMatching(path.join(stageNativeDir, 'dist'), (entryPath, entry) =>
    entry.isFile() && /^(README\.md|run_host\.(bat|sh)|node_path\.txt)$/i.test(entry.name),
  );

  const manifestPath = path.join(extensionDist, 'manifest.json');
  const extensionId = extensionIdFromManifest(manifestPath);
  await fs.writeFile(
    path.join(payloadDir, 'payload-config.json'),
    JSON.stringify({ version, extensionId, hostName: 'com.chromemcp.nativehost', port: 12306 }, null, 2),
  );

  console.log('Compressing embedded runtime...');
  run('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${payloadDir.replaceAll("'", "''")}\\*' -DestinationPath '${bundleZip.replaceAll("'", "''")}' -CompressionLevel Optimal`,
  ]);

  const launcherSource = path.join(root, 'scripts', 'sea-launcher.cjs');
  const launcherPath = path.join(stageDir, 'sea-launcher.cjs');
  await fs.copyFile(launcherSource, launcherPath);
  const iconAssetPath = path.join(stageDir, 'chrome-mcp-icon.ico');
  await fs.copyFile(iconSource, iconAssetPath);
  const desktopUiSource = path.join(root, 'scripts', 'desktop-ui.ps1');
  const desktopUiAssetPath = path.join(stageDir, 'desktop-ui.ps1');
  await fs.copyFile(desktopUiSource, desktopUiAssetPath);
  await fs.writeFile(
    seaConfigPath,
    JSON.stringify(
      {
        main: launcherPath,
        output: seaBlobPath,
        disableExperimentalSEAWarning: true,
        useCodeCache: false,
        assets: {
          'chrome-mcp-bundle.zip': bundleZip,
          'chrome-mcp-desktop-ui.ps1': desktopUiAssetPath,
          'chrome-mcp-icon.ico': iconAssetPath,
        },
      },
      null,
      2,
    ),
  );

  run(process.execPath, [`--experimental-sea-config=${seaConfigPath}`]);
  await fs.copyFile(process.execPath, seaStubPath);
  run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    path.join(root, 'scripts', 'set-windows-icon.ps1'),
    '-ExePath',
    seaStubPath,
    '-IconPath',
    iconAssetPath,
  ]);
  run('npx.cmd', [
    '--yes',
    'postject@1.0.0-alpha.6',
    seaStubPath,
    'NODE_SEA_BLOB',
    seaBlobPath,
    '--sentinel-fuse',
    'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  ]);

  let publishedExe = outputExe;
  try {
    await fs.copyFile(seaStubPath, outputExe);
  } catch (error) {
    if (!['EBUSY', 'EPERM', 'EACCES'].includes(error?.code)) throw error;
    publishedExe = outputExe.replace(/\.exe$/i, '.new.exe');
    await fs.copyFile(seaStubPath, publishedExe);
    console.warn(`发布文件正在被运行中的客户端占用，已改写入：${publishedExe}`);
    console.warn('关闭旧客户端后，可将该 .new.exe 改名为原文件名。');
  }
  console.log(`\n完成：${publishedExe}`);
  console.log(`大小：${( (await fs.stat(publishedExe)).size / 1024 / 1024 ).toFixed(1)} MB`);
}

await main();
