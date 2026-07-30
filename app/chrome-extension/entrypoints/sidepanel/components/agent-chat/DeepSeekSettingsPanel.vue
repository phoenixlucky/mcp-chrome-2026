<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center"
    @click.self="$emit('close')"
  >
    <div
      class="w-full max-w-md mx-4 p-4 space-y-4"
      :style="{
        backgroundColor: 'var(--ac-surface, #ffffff)',
        border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
        borderRadius: 'var(--ac-radius-card, 12px)',
        boxShadow: 'var(--ac-shadow-float, 0 4px 20px -2px rgba(0,0,0,0.2))',
      }"
    >
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold" :style="{ color: 'var(--ac-text, #1a1a1a)' }"
          >DeepSeek API</h2
        >
        <button
          class="ac-btn text-sm"
          :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }"
          @click="$emit('close')"
          >{{ copy.close }}</button
        >
      </div>

      <p class="text-xs" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">
        {{
          configured
            ? copy.configured(source === 'plugin' ? copy.thisPlugin : 'DEEPSEEK_API_KEY')
            : copy.notConfigured
        }}
        {{ copy.keyHint }}
      </p>

      <label class="block text-xs space-y-1" :style="{ color: 'var(--ac-text, #1a1a1a)' }">
        <span>{{ copy.apiKey }}</span>
        <input
          v-model="apiKey"
          type="password"
          autocomplete="new-password"
          :placeholder="configured ? copy.savedKeyPlaceholder : 'sk-...'"
          class="w-full px-2 py-1.5"
          :style="inputStyle"
        />
      </label>

      <label class="block text-xs space-y-1" :style="{ color: 'var(--ac-text, #1a1a1a)' }">
        <span>{{ copy.baseUrl }}</span>
        <input
          v-model="baseUrl"
          placeholder="https://api.deepseek.com"
          class="w-full px-2 py-1.5"
          :style="inputStyle"
        />
      </label>

      <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
      <p v-else-if="saveSucceeded" class="text-xs text-emerald-600">{{ copy.saved }}</p>
      <div class="flex justify-end gap-2">
        <button
          v-if="configured && source === 'plugin'"
          class="px-3 py-1.5 text-xs ac-btn"
          :style="secondaryStyle"
          :disabled="saving"
          @click="clearKey"
          >{{ copy.removeKey }}</button
        >
        <button
          class="px-3 py-1.5 text-xs ac-btn"
          :style="primaryStyle"
          :disabled="saving || !apiKey.trim()"
          @click="save"
        >
          {{ saving ? copy.saving : copy.save }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useAgentLocale } from '../../composables/useAgentLocale';

const props = defineProps<{
  open: boolean;
  serverPort: number;
  ensureServer: () => Promise<boolean>;
  getServerPort: () => number | null;
}>();
defineEmits<{ close: [] }>();

const apiKey = ref('');
const baseUrl = ref('');
const configured = ref(false);
const source = ref<string | null>(null);
const saving = ref(false);
const error = ref('');
const saveSucceeded = ref(false);
const { isChinese } = useAgentLocale();
const copy = computed(() =>
  isChinese.value
    ? {
        close: '关闭',
        apiKey: 'API 密钥',
        baseUrl: '基础地址（可选）',
        saved: '已保存到本机。',
        savedKeyPlaceholder: 'sk-••••••••（已保存）',
        removeKey: '移除已保存的密钥',
        saving: '保存中…',
        save: '保存',
        thisPlugin: '本插件',
        configured: (source: string) => `已通过${source}配置。`,
        notConfigured: '尚未配置。',
        keyHint: '密钥仅保存在本机，不会返回给扩展。',
      }
    : {
        close: 'Close',
        apiKey: 'API Key',
        baseUrl: 'Base URL (optional)',
        saved: 'Saved locally.',
        savedKeyPlaceholder: 'sk-•••••••• (saved)',
        removeKey: 'Remove saved key',
        saving: 'Saving...',
        save: 'Save',
        thisPlugin: 'this plugin',
        configured: (source: string) => `Configured via ${source}.`,
        notConfigured: 'Not configured.',
        keyHint: 'The key is saved locally and is never returned to the extension.',
      },
);

const inputStyle = computed(() => ({
  backgroundColor: 'var(--ac-surface, #ffffff)',
  border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
  borderRadius: 'var(--ac-radius-button, 8px)',
  color: 'var(--ac-text, #1a1a1a)',
}));
const secondaryStyle = computed(() => ({
  color: 'var(--ac-text-muted, #6e6e6e)',
  border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
  borderRadius: 'var(--ac-radius-button, 8px)',
}));
const primaryStyle = computed(() => ({
  backgroundColor: 'var(--ac-accent, #c87941)',
  color: 'var(--ac-accent-contrast, #ffffff)',
  borderRadius: 'var(--ac-radius-button, 8px)',
}));

async function request(method: 'GET' | 'PUT', body?: Record<string, unknown>): Promise<void> {
  const serverPort = props.getServerPort();
  if (!Number.isInteger(serverPort) || serverPort <= 0)
    throw new Error('本地智能助手服务未连接，请稍后重试。');
  const response = await fetch(`http://127.0.0.1:${serverPort}/agent/settings/deepseek`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as {
    configured?: boolean;
    source?: string | null;
    baseUrl?: string;
    error?: string;
  };
  if (!response.ok) throw new Error(data.error || 'Unable to save DeepSeek settings.');
  configured.value = Boolean(data.configured);
  source.value = data.source ?? null;
  baseUrl.value = data.baseUrl ?? '';
}

async function load(): Promise<void> {
  if (!props.open || !props.serverPort) return;
  error.value = '';
  saveSucceeded.value = false;
  apiKey.value = '';
  try {
    await request('GET');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
}

async function save(): Promise<void> {
  saving.value = true;
  error.value = '';
  try {
    if (!(await props.ensureServer())) {
      throw new Error('本地智能助手服务未连接，请先点击“重新连接”。');
    }
    await request('PUT', { apiKey: apiKey.value, baseUrl: baseUrl.value });
    apiKey.value = '';
    saveSucceeded.value = configured.value && source.value === 'plugin';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    saving.value = false;
  }
}

async function clearKey(): Promise<void> {
  saving.value = true;
  error.value = '';
  try {
    await request('PUT', { clearApiKey: true, baseUrl: baseUrl.value });
    saveSucceeded.value = false;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    saving.value = false;
  }
}

watch(() => [props.open, props.serverPort] as const, load, { immediate: true });
</script>
