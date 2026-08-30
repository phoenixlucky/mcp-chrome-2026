import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;
const source = path.join(root, 'releases', `chrome-mcp-bridge-${version}-win-x64.exe`);
const destinationDir = path.join(root, 'app', 'desktop-client', 'bridge');
const destination = path.join(destinationDir, 'chrome-mcp-bridge.exe');

try {
  await fs.access(source);
} catch {
  throw new Error(`找不到 ${source}，请先运行 package:windows 生成桥接服务。`);
}

await fs.mkdir(destinationDir, { recursive: true });
await fs.copyFile(source, destination);
console.log(`已准备 Tauri bridge：${destination}`);
