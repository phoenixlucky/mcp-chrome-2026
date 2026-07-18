import { eq, inArray } from 'drizzle-orm';
import { getDb } from './db/client';
import { appSettings } from './db/schema';

const DEEPSEEK_API_KEY = 'deepseek_api_key';
const DEEPSEEK_BASE_URL = 'deepseek_base_url';

export interface DeepSeekSettingsInput {
  apiKey?: string;
  baseUrl?: string;
  clearApiKey?: boolean;
}

export interface DeepSeekSettings {
  apiKey?: string;
  baseUrl?: string;
}

async function setValue(key: string, value: string): Promise<void> {
  const db = getDb();
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date().toISOString() },
    });
}

export async function getDeepSeekSettings(): Promise<DeepSeekSettings> {
  const db = getDb();
  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, [DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL]));
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    apiKey: values.get(DEEPSEEK_API_KEY),
    baseUrl: values.get(DEEPSEEK_BASE_URL),
  };
}

export async function updateDeepSeekSettings(input: DeepSeekSettingsInput): Promise<void> {
  const db = getDb();
  if (input.clearApiKey) {
    await db.delete(appSettings).where(eq(appSettings.key, DEEPSEEK_API_KEY));
  } else if (input.apiKey?.trim()) {
    await setValue(DEEPSEEK_API_KEY, input.apiKey.trim());
  }

  if (input.baseUrl !== undefined) {
    const baseUrl = input.baseUrl.trim();
    if (baseUrl) await setValue(DEEPSEEK_BASE_URL, baseUrl);
    else await db.delete(appSettings).where(eq(appSettings.key, DEEPSEEK_BASE_URL));
  }
}
