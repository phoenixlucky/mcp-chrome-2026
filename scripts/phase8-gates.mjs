import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

const total = Number(process.env.PHASE8_REQUESTS || 1_000);
const status = await runAdmissionLoad(total);
console.log(JSON.stringify({ gate: 'mixed-read-write', requests: total, status }));
const durationMs = Number(process.env.PHASE8_STRESS_MS || 0);
if (durationMs > 0) {
  const memory = await runMemoryStress(durationMs);
  console.log(JSON.stringify({ gate: 'memory-stress', durationMs, memory }));
} else {
  console.log('Memory stress is opt-in; set PHASE8_STRESS_MS and use node --expose-gc when needed.');
}
