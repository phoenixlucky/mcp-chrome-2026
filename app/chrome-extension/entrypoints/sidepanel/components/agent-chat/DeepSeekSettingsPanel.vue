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
          >Close</button
        >
      </div>

      <p class="text-xs" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">
        {{
          configured
            ? `Configured via ${source === 'plugin' ? 'this plugin' : 'DEEPSEEK_API_KEY'}.`
            : 'Not configured.'
        }}
        The key is saved locally and is never returned to the extension.
      </p>

      <label class="block text-xs space-y-1" :style="{ color: 'var(--ac-text, #1a1a1a)' }">
        <span>API Key</span>
        <input
          v-model="apiKey"
          type="password"
          autocomplete="new-password"
          placeholder="sk-..."
          class="w-full px-2 py-1.5"
          :style="inputStyle"
        />
      </label>

      <label class="block text-xs space-y-1" :style="{ color: 'var(--ac-text, #1a1a1a)' }">
        <span>Base URL (optional)</span>
        <input
          v-model="baseUrl"
          placeholder="https://api.deepseek.com"
          class="w-full px-2 py-1.5"
          :style="inputStyle"
        />
      </label>

      <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <button
          v-if="configured && source === 'plugin'"
          class="px-3 py-1.5 text-xs ac-btn"
          :style="secondaryStyle"
          :disabled="saving"
          @click="clearKey"
          >Remove saved key</button
        >
        <button
          class="px-3 py-1.5 text-xs ac-btn"
          :style="primaryStyle"
          :disabled="saving || !apiKey.trim()"
          @click="save"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

const props = defineProps<{ open: boolean; serverPort: number }>();
defineEmits<{ close: [] }>();

const apiKey = ref('');
const baseUrl = ref('');
const configured = ref(false);
const source = ref<string | null>(null);
const saving = ref(false);
const error = ref('');

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
  const response = await fetch(`http://127.0.0.1:${props.serverPort}/agent/settings/deepseek`, {
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
    await request('PUT', { apiKey: apiKey.value, baseUrl: baseUrl.value });
    apiKey.value = '';
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
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    saving.value = false;
  }
}

watch(() => [props.open, props.serverPort] as const, load, { immediate: true });
</script>
