import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];

function requireText(file, text, description) {
  if (!read(file).includes(text)) failures.push(`${description} (${file})`);
}

function runStaticGates() {
  requireText('app/native-server/src/native-frame.ts', 'MAX_NATIVE_MESSAGE_SIZE_BYTES', 'Native 单条消息大小阈值');
  requireText('app/native-server/src/native-messaging-host.ts', 'NativeMessageFrameDecoder', 'Native 半包/粘包解码器已接入');
  requireText('app/native-server/src/native-messaging-host.ts', "'EXECUTION_UNKNOWN'", '副作用断线语义');
  requireText('app/native-server/src/native-messaging-host.ts', "type: 'cancel'", '超时/取消发送 cancel');
  requireText('app/native-server/src/artifact-store.ts', 'fs.renameSync', 'Artifact 原子改名');
  requireText('app/native-server/src/artifact-store.ts', 'cleanupIncomplete', 'Artifact 中断清理');
  requireText('app/native-server/src/mcp/register-tools.ts', 'QUEUE_FULL', '队列满错误码');
  requireText('app/native-server/src/mcp/register-tools.ts', 'averageQueueMs', '队列观测指标');
  requireText('app/chrome-extension/entrypoints/background/native-host.ts', 'chrome.storage.local', 'Service Worker 状态持久化');
  requireText('app/chrome-extension/entrypoints/background/native-host.ts', 'sw_startup', 'Service Worker 恢复重连');
  requireText('app/native-server/src/server/index.ts', "'/mcp-new'", '/mcp-new 主流程');
  requireText('app/native-server/src/server/index.ts', "'/mcp'", '/mcp 兼容入口');
  requireText('packages/shared/src/native-protocol.ts', "'UNSUPPORTED_VERSION'", 'V1 明确拒绝且 V2 校验');
}

async function runAdmissionLoad(total = 1_000) {
  const modulePath = path.join(root, 'app/native-server/dist/mcp/register-tools.js');
  if (!fs.existsSync(modulePath)) throw new Error('缺少 dist；请先运行 pnpm run build:native');
  const { acquireToolCallSlot, getToolAdmissionStats } = await import(pathToFileURL(modulePath).href);
  const workers = Math.max(1, Math.min(8, getToolAdmissionStats().maxActive));
  let next = 0;
  let completed = 0;
  const worker = async () => {
    while (true) {
      const index = next++;
      if (index >= total) return;
      const release = await acquireToolCallSlot(undefined, index % 2 ? 'write' : 'read', `profile-${index % 4}`);
      await new Promise((resolve) => setImmediate(resolve));
      release();
      completed += 1;
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));
  const status = getToolAdmissionStats();
  if (completed !== total || status.active !== 0 || status.queued !== 0) {
    throw new Error(`混合负载未归零: completed=${completed}, active=${status.active}, queued=${status.queued}`);
  }
  return status;
}

async function runMemoryStress(durationMs) {
  const startedAt = Date.now();
  const samples = [];
  while (Date.now() - startedAt < durationMs) {
    await runAdmissionLoad(1_000);
    if (global.gc) global.gc();
    samples.push(process.memoryUsage().heapUsed);
  }
  const first = samples[0] ?? 0;
  const last = samples.at(-1) ?? first;
  const growth = first ? (last - first) / first : 0;
  if (growth > 0.25) throw new Error(`检测到持续堆增长 ${(growth * 100).toFixed(1)}%`);
  return { samples: samples.length, heapGrowth: growth };
}

runStaticGates();
if (failures.length) {
  console.error('Phase 8 static gates failed:\n- ' + failures.join('\n- '));
  process.exitCode = 1;
} else {
  const total = Number(process.env.PHASE8_REQUESTS || 1_000);
  const status = await runAdmissionLoad(total);
  console.log(JSON.stringify({ gate: 'mixed-read-write', requests: total, status }));
  const durationMs = Number(process.env.PHASE8_STRESS_MS || 0);
  if (durationMs > 0) {
    const memory = await runMemoryStress(durationMs);
    console.log(JSON.stringify({ gate: 'memory-stress', durationMs, memory }));
  } else {
    console.log('30 分钟压力门禁未自动执行；需要时设置 PHASE8_STRESS_MS=1800000 并使用 node --expose-gc。');
  }
}
