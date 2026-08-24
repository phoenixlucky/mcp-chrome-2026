import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserProfileManager } from './browser-profile-manager.js';

describe('BrowserProfileManager', () => {
  let profileDir: string;
  let previousProfileDir: string | undefined;

  beforeEach(async () => {
    previousProfileDir = process.env.CHROME_MCP_PROFILE_DIR;
    profileDir = await mkdtemp(path.join(os.tmpdir(), 'chrome-mcp-profile-test-'));
    process.env.CHROME_MCP_PROFILE_DIR = profileDir;
  });

  afterEach(async () => {
    if (previousProfileDir === undefined) delete process.env.CHROME_MCP_PROFILE_DIR;
    else process.env.CHROME_MCP_PROFILE_DIR = previousProfileDir;
    await rm(profileDir, { recursive: true, force: true });
  });

  test('creates, lists, and deletes a profile without touching its browser data', async () => {
    const manager = new BrowserProfileManager();
    const created = await manager.create({ name: 'Work Browser' });

    expect(created.id).toBe('work-browser');
    expect(created.status).toBe('stopped');
    expect((await manager.list()).map((profile) => profile.id)).toEqual(['work-browser']);

    await expect(manager.delete(created.id)).resolves.toEqual({
      id: 'work-browser',
      userDataDir: path.join(profileDir, 'work-browser'),
      dataRemoved: false,
    });
    await expect(manager.list()).resolves.toEqual([]);
  });

  test('keeps concurrent profile creation isolated and persisted', async () => {
    const manager = new BrowserProfileManager();
    await Promise.all([
      manager.create({ name: 'Account A', id: 'account-a' }),
      manager.create({ name: 'Account B', id: 'account-b' }),
    ]);

    const profiles = await manager.list();
    expect(profiles.map((profile) => profile.id).sort()).toEqual(['account-a', 'account-b']);
    expect(new Set(profiles.map((profile) => profile.userDataDir)).size).toBe(2);
  });
});
