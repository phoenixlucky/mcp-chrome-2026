import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { AttachmentService } from './attachment-service';

const ENV_NAMES = [
  'CHROME_MCP_AGENT_DATA_DIR',
  'CHROME_MCP_MAX_ATTACHMENT_SIZE_BYTES',
  'CHROME_MCP_MAX_ATTACHMENT_DIR_SIZE_BYTES',
  'CHROME_MCP_ATTACHMENT_TTL_MS',
] as const;

describe('AttachmentService limits and lifecycle', () => {
  let dataDir: string;
  let service: AttachmentService;
  let previousEnv: Partial<Record<(typeof ENV_NAMES)[number], string | undefined>>;

  beforeEach(async () => {
    previousEnv = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chrome-mcp-attachments-'));
    process.env.CHROME_MCP_AGENT_DATA_DIR = dataDir;
    process.env.CHROME_MCP_MAX_ATTACHMENT_SIZE_BYTES = '3';
    process.env.CHROME_MCP_MAX_ATTACHMENT_DIR_SIZE_BYTES = '5';
    process.env.CHROME_MCP_ATTACHMENT_TTL_MS = '604800000';
    service = new AttachmentService();
  });

  afterEach(async () => {
    service.dispose();
    await fs.rm(dataDir, { recursive: true, force: true });
    for (const name of ENV_NAMES) {
      const value = previousEnv[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  test('enforces per-file and aggregate directory limits', async () => {
    const attachment = {
      type: 'image' as const,
      mimeType: 'image/png',
      dataBase64: Buffer.from('abc').toString('base64'),
    };

    const saved = await service.saveAttachment({
      projectId: 'project-1',
      messageId: 'message-1',
      attachment,
      index: 0,
    });
    expect(saved.metadata.sizeBytes).toBe(3);
    expect(saved.filename).not.toContain('/');

    await expect(
      service.saveAttachment({
        projectId: 'project-1',
        messageId: 'message-2',
        attachment,
        index: 1,
      }),
    ).rejects.toThrow(/directory exceeds/);

    await expect(
      service.saveAttachment({
        projectId: 'project-2',
        messageId: 'message-3',
        attachment: { ...attachment, dataBase64: Buffer.from('abcd').toString('base64') },
        index: 0,
      }),
    ).rejects.toThrow(/size limit/);
  });

  test('removes expired files during cleanup', async () => {
    const saved = await service.saveAttachment({
      projectId: 'project-1',
      messageId: '../message',
      attachment: {
        type: 'image',
        mimeType: 'image/png',
        dataBase64: Buffer.from('abc').toString('base64'),
      },
      index: 0,
    });
    await fs.utimes(saved.absolutePath, new Date(0), new Date(0));
    process.env.CHROME_MCP_ATTACHMENT_TTL_MS = '1';

    await (service as any).cleanupExpired();
    await expect(fs.access(saved.absolutePath)).rejects.toThrow();
  });
});
