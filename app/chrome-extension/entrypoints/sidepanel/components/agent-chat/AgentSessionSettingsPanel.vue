<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center"
    @click.self="handleClose"
  >
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/40" />

    <!-- Panel -->
    <div
      class="relative w-full max-w-md mx-4 max-h-[85vh] overflow-hidden flex flex-col"
      :style="{
        backgroundColor: 'var(--ac-surface, #ffffff)',
        border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
        borderRadius: 'var(--ac-radius-card, 12px)',
        boxShadow: 'var(--ac-shadow-float, 0 4px 20px -2px rgba(0,0,0,0.2))',
      }"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-4 py-3"
        :style="{ borderBottom: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)' }"
      >
        <h2 class="text-sm font-semibold" :style="{ color: 'var(--ac-text, #1a1a1a)' }">
          {{ copy.title }}
        </h2>
        <button
          class="p-1 ac-btn"
          :style="{
            color: 'var(--ac-text-muted, #6e6e6e)',
            borderRadius: 'var(--ac-radius-button)',
          }"
          @click="handleClose"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Content (scrollable) -->
      <div class="flex-1 overflow-y-auto ac-scroll px-4 py-3 space-y-4">
        <!-- Loading State -->
        <div v-if="isLoading" class="py-8 text-center">
          <div class="text-sm" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">
            {{ copy.loading }}
          </div>
        </div>

        <template v-else>
          <!-- Session Info -->
          <div class="space-y-2">
            <label
              class="text-[10px] font-bold uppercase tracking-wider"
              :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
            >
              {{ copy.sessionInfo }}
            </label>
            <div class="text-xs space-y-1" :style="{ color: 'var(--ac-text, #1a1a1a)' }">
              <div class="flex justify-between">
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{ copy.engine }}</span>
                <span
                  class="px-1.5 py-0.5 text-[10px]"
                  :style="{
                    backgroundColor: getEngineColor(session?.engineName || ''),
                    color: '#ffffff',
                    borderRadius: 'var(--ac-radius-button, 8px)',
                  }"
                >
                  {{ session?.engineName || 'Unknown' }}
                </span>
              </div>
              <div v-if="localModel" class="flex justify-between">
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{ copy.model }}</span>
                <span class="font-mono text-[10px]">{{ localModel }}</span>
              </div>
              <div v-if="session?.engineSessionId" class="flex justify-between">
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{
                  copy.engineSession
                }}</span>
                <span class="font-mono text-[10px] truncate max-w-[180px]">{{
                  session.engineSessionId
                }}</span>
              </div>
            </div>
          </div>

          <!-- Model Selection -->
          <div class="space-y-2">
            <label
              class="text-[10px] font-bold uppercase tracking-wider"
              :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
            >
              {{ copy.model }}
            </label>
            <select
              v-model="localModel"
              class="w-full px-2 py-1.5 text-xs"
              :style="{
                backgroundColor: 'var(--ac-surface, #ffffff)',
                border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                borderRadius: 'var(--ac-radius-button, 8px)',
                color: 'var(--ac-text, #1a1a1a)',
              }"
            >
              <option value="">{{ copy.serverDefault }}</option>
              <option v-for="m in availableModels" :key="m.id" :value="m.id">
                {{ m.name }}
              </option>
            </select>
          </div>

          <!-- Reasoning Effort (Codex only) -->
          <div v-if="isCodexEngine" class="space-y-2">
            <label
              class="text-[10px] font-bold uppercase tracking-wider"
              :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
            >
              {{ copy.reasoningEffort }}
            </label>
            <select
              v-model="localReasoningEffort"
              class="w-full px-2 py-1.5 text-xs"
              :style="{
                backgroundColor: 'var(--ac-surface, #ffffff)',
                border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                borderRadius: 'var(--ac-radius-button, 8px)',
                color: 'var(--ac-text, #1a1a1a)',
              }"
            >
              <option v-for="effort in availableReasoningEfforts" :key="effort" :value="effort">
                {{ effort }}
              </option>
            </select>
            <p class="text-[10px]" :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }">
              {{ copy.reasoningHint }}
              <span v-if="!availableReasoningEfforts.includes('xhigh')" class="block mt-1">
                {{ copy.xhighHint }}
              </span>
            </p>
          </div>

          <!-- Permission Mode (Claude only) -->
          <div v-if="isClaudeEngine" class="space-y-2">
            <label
              class="text-[10px] font-bold uppercase tracking-wider"
              :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
            >
              {{ copy.permissionMode }}
            </label>
            <select
              v-model="localPermissionMode"
              class="w-full px-2 py-1.5 text-xs"
              :style="{
                backgroundColor: 'var(--ac-surface, #ffffff)',
                border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                borderRadius: 'var(--ac-radius-button, 8px)',
                color: 'var(--ac-text, #1a1a1a)',
              }"
            >
              <option value="">{{ copy.default }}</option>
              <option value="default">default - {{ copy.askApproval }}</option>
              <option value="acceptEdits">acceptEdits - {{ copy.acceptEdits }}</option>
              <option value="bypassPermissions">bypassPermissions - {{ copy.acceptAll }}</option>
              <option value="plan">plan - {{ copy.planOnly }}</option>
              <option value="dontAsk">dontAsk - {{ copy.noConfirmation }}</option>
            </select>
            <p class="text-[10px]" :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }">
              {{ copy.permissionHint }}
            </p>
          </div>

          <!-- System Prompt Config (Claude only) -->
          <div v-if="isClaudeEngine" class="space-y-2">
            <label
              class="text-[10px] font-bold uppercase tracking-wider"
              :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
            >
              {{ copy.systemPrompt }}
            </label>
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  :checked="!localUseCustomPrompt"
                  @change="localUseCustomPrompt = false"
                />
                <span :style="{ color: 'var(--ac-text, #1a1a1a)' }"
                  >{{ copy.usePreset }} (claude_code)</span
                >
              </label>
              <div v-if="!localUseCustomPrompt" class="pl-5">
                <label class="flex items-center gap-2 text-[10px]">
                  <input v-model="localAppendToPrompt" type="checkbox" />
                  <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{
                    copy.appendCustomText
                  }}</span>
                </label>
                <textarea
                  v-if="localAppendToPrompt"
                  v-model="localPromptAppend"
                  class="mt-1 w-full px-2 py-1.5 text-xs resize-none"
                  :style="{
                    backgroundColor: 'var(--ac-surface, #ffffff)',
                    border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                    borderRadius: 'var(--ac-radius-button, 8px)',
                    color: 'var(--ac-text, #1a1a1a)',
                    fontFamily: 'var(--ac-font-mono, monospace)',
                  }"
                  rows="3"
                  :placeholder="copy.appendPlaceholder"
                />
              </div>
              <label class="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  :checked="localUseCustomPrompt"
                  @change="localUseCustomPrompt = true"
                />
                <span :style="{ color: 'var(--ac-text, #1a1a1a)' }">{{
                  copy.useCustomPrompt
                }}</span>
              </label>
              <textarea
                v-if="localUseCustomPrompt"
                v-model="localCustomPrompt"
                class="w-full px-2 py-1.5 text-xs resize-none"
                :style="{
                  backgroundColor: 'var(--ac-surface, #ffffff)',
                  border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                  borderRadius: 'var(--ac-radius-button, 8px)',
                  color: 'var(--ac-text, #1a1a1a)',
                  fontFamily: 'var(--ac-font-mono, monospace)',
                }"
                rows="4"
                :placeholder="copy.customPromptPlaceholder"
              />
            </div>
          </div>

          <!-- Management Info (Claude only, read-only) -->
          <div v-if="isClaudeEngine && managementInfo" class="space-y-2">
            <label
              class="text-[10px] font-bold uppercase tracking-wider"
              :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
            >
              {{ copy.sdkInfo }}
            </label>
            <div
              class="text-[10px] space-y-1 p-2"
              :style="{
                backgroundColor: 'var(--ac-surface-inset, #f5f5f5)',
                borderRadius: 'var(--ac-radius-inner, 8px)',
              }"
            >
              <div v-if="managementInfo.model" class="flex justify-between">
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{
                  copy.activeModel
                }}</span>
                <span class="font-mono" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{
                  managementInfo.model
                }}</span>
              </div>
              <div v-if="managementInfo.claudeCodeVersion" class="flex justify-between">
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">Claude Code</span>
                <span class="font-mono" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{
                  managementInfo.claudeCodeVersion
                }}</span>
              </div>
              <div v-if="managementInfo.tools?.length" class="flex justify-between">
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{ copy.tools }}</span>
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{
                  managementInfo.tools.length
                }}</span>
              </div>
              <div v-if="managementInfo.mcpServers?.length" class="flex justify-between">
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{
                  copy.mcpServers
                }}</span>
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{
                  managementInfo.mcpServers.length
                }}</span>
              </div>
            </div>
            <!-- Tool List (expandable) -->
            <details v-if="managementInfo.tools?.length" class="text-[10px]">
              <summary class="cursor-pointer" :style="{ color: 'var(--ac-link, #3b82f6)' }">
                {{ copy.viewTools }}（{{ managementInfo.tools.length }}）
              </summary>
              <div
                class="mt-1 p-2 max-h-32 overflow-y-auto ac-scroll"
                :style="{
                  backgroundColor: 'var(--ac-surface-inset, #f5f5f5)',
                  borderRadius: 'var(--ac-radius-inner, 8px)',
                }"
              >
                <div
                  v-for="tool in managementInfo.tools"
                  :key="tool"
                  class="font-mono truncate"
                  :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }"
                >
                  {{ tool }}
                </div>
              </div>
            </details>
            <!-- MCP Server List (expandable) -->
            <details v-if="managementInfo.mcpServers?.length" class="text-[10px]">
              <summary class="cursor-pointer" :style="{ color: 'var(--ac-link, #3b82f6)' }">
                {{ copy.viewMcpServers }}（{{ managementInfo.mcpServers.length }}）
              </summary>
              <div
                class="mt-1 p-2 max-h-32 overflow-y-auto ac-scroll"
                :style="{
                  backgroundColor: 'var(--ac-surface-inset, #f5f5f5)',
                  borderRadius: 'var(--ac-radius-inner, 8px)',
                }"
              >
                <div
                  v-for="server in managementInfo.mcpServers"
                  :key="server.name"
                  class="font-mono truncate flex justify-between gap-2"
                  :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }"
                >
                  <span>{{ server.name }}</span>
                  <span
                    class="text-[9px] px-1"
                    :style="{
                      backgroundColor: server.status === 'connected' ? '#10b981' : '#6b7280',
                      color: '#fff',
                      borderRadius: 'var(--ac-radius-button, 8px)',
                    }"
                    >{{ server.status }}</span
                  >
                </div>
              </div>
            </details>
          </div>
        </template>
      </div>

      <!-- Footer -->
      <div
        class="flex items-center justify-end gap-2 px-4 py-3"
        :style="{ borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)' }"
      >
        <button
          class="px-3 py-1.5 text-xs ac-btn"
          :style="{
            color: 'var(--ac-text-muted, #6e6e6e)',
            border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
            borderRadius: 'var(--ac-radius-button, 8px)',
          }"
          @click="handleClose"
        >
          {{ copy.cancel }}
        </button>
        <button
          class="px-3 py-1.5 text-xs ac-btn"
          :style="{
            backgroundColor: 'var(--ac-accent, #c87941)',
            color: 'var(--ac-accent-contrast, #ffffff)',
            borderRadius: 'var(--ac-radius-button, 8px)',
          }"
          :disabled="isSaving"
          @click="handleSave"
        >
          {{ isSaving ? copy.saving : copy.save }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import type {
  AgentSession,
  AgentManagementInfo,
  AgentSystemPromptConfig,
  CodexReasoningEffort,
  AgentSessionOptionsConfig,
} from '@ethanwilkins/chrome-mcp-shared-2026';
import {
  getModelsForCli,
  getCodexReasoningEfforts,
  getDefaultModelForCli,
} from '@/common/agent-models';
import { useAgentLocale } from '../../composables/useAgentLocale';

const { isChinese } = useAgentLocale();
const copy = computed(() =>
  isChinese.value
    ? {
        title: '会话设置',
        loading: '正在加载会话信息…',
        sessionInfo: '会话信息',
        engine: '引擎',
        model: '模型',
        engineSession: '引擎会话',
        serverDefault: '默认（服务端设置）',
        reasoningEffort: '推理强度',
        reasoningHint: '控制推理深度。强度越高，质量越好但速度越慢。',
        xhighHint: '提示：xhigh 仅适用于 gpt-5.2 和 gpt-5.1-codex-max 模型。',
        permissionMode: '权限模式',
        default: '默认',
        askApproval: '请求确认',
        acceptEdits: '自动接受文件修改',
        acceptAll: '自动接受全部操作',
        planOnly: '仅规划模式',
        noConfirmation: '不再确认',
        permissionHint: '控制 Claude SDK 如何处理工具授权请求。',
        systemPrompt: '系统提示词',
        usePreset: '使用预设',
        appendCustomText: '追加自定义文本',
        appendPlaceholder: '追加的说明…',
        useCustomPrompt: '使用自定义提示词',
        customPromptPlaceholder: '输入自定义系统提示词…',
        sdkInfo: 'SDK 信息',
        activeModel: '当前模型',
        tools: '工具',
        mcpServers: 'MCP 服务器',
        viewTools: '查看工具',
        viewMcpServers: '查看 MCP 服务器',
        cancel: '取消',
        saving: '保存中…',
        save: '保存',
      }
    : {
        title: 'Session Settings',
        loading: 'Loading session info...',
        sessionInfo: 'Session Info',
        engine: 'Engine',
        model: 'Model',
        engineSession: 'Engine Session',
        serverDefault: 'Default (server setting)',
        reasoningEffort: 'Reasoning Effort',
        reasoningHint: 'Controls the reasoning depth. Higher effort = better quality but slower.',
        xhighHint: 'Note: xhigh is only available for gpt-5.2 and gpt-5.1-codex-max models.',
        permissionMode: 'Permission Mode',
        default: 'Default',
        askApproval: 'Ask for approval',
        acceptEdits: 'Auto-accept file edits',
        acceptAll: 'Auto-accept all',
        planOnly: 'Plan mode only',
        noConfirmation: 'No confirmation',
        permissionHint: 'Controls how the Claude SDK handles tool approval requests.',
        systemPrompt: 'System Prompt',
        usePreset: 'Use preset',
        appendCustomText: 'Append custom text',
        appendPlaceholder: 'Additional instructions to append...',
        useCustomPrompt: 'Use custom prompt',
        customPromptPlaceholder: 'Enter custom system prompt...',
        sdkInfo: 'SDK Info',
        activeModel: 'Active Model',
        tools: 'Tools',
        mcpServers: 'MCP Servers',
        viewTools: 'View tools',
        viewMcpServers: 'View MCP servers',
        cancel: 'Cancel',
        saving: 'Saving...',
        save: 'Save',
      },
);

const props = defineProps<{
  open: boolean;
  session: AgentSession | null;
  managementInfo: AgentManagementInfo | null;
  isLoading: boolean;
  isSaving: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [settings: SessionSettings];
}>();

export interface SessionSettings {
  model: string;
  permissionMode: string;
  systemPromptConfig: AgentSystemPromptConfig | null;
  optionsConfig?: AgentSessionOptionsConfig;
}

// Local state
const localModel = ref('');
const localPermissionMode = ref('');
const localReasoningEffort = ref<CodexReasoningEffort>('medium');
const localUseCustomPrompt = ref(false);
const localCustomPrompt = ref('');
const localAppendToPrompt = ref(false);
const localPromptAppend = ref('');

// Computed
const isClaudeEngine = computed(() => props.session?.engineName === 'claude');
const isCodexEngine = computed(() => props.session?.engineName === 'codex');

// Get available reasoning efforts based on selected model
const availableReasoningEfforts = computed<readonly CodexReasoningEffort[]>(() => {
  if (!isCodexEngine.value) return [];
  const effectiveModel = localModel.value || getDefaultModelForCli('codex');
  return getCodexReasoningEfforts(effectiveModel);
});

// Normalize reasoning effort when model changes
const normalizedReasoningEffort = computed(() => {
  const supported = availableReasoningEfforts.value;
  if (supported.length === 0) return localReasoningEffort.value;
  if (supported.includes(localReasoningEffort.value)) return localReasoningEffort.value;
  return supported[supported.length - 1]; // fallback to highest supported
});

const availableModels = computed(() => {
  if (!props.session?.engineName) return [];
  return getModelsForCli(props.session.engineName);
});

// Initialize local state when session changes
watch(
  () => props.session,
  (session) => {
    if (session) {
      localModel.value = session.model || '';
      localPermissionMode.value = session.permissionMode || '';

      // Initialize reasoning effort from session's codex config
      const codexConfig = session.optionsConfig?.codexConfig;
      if (codexConfig?.reasoningEffort) {
        localReasoningEffort.value = codexConfig.reasoningEffort;
      } else {
        localReasoningEffort.value = 'medium';
      }

      // Parse system prompt config based on type
      const config = session.systemPromptConfig;
      if (config) {
        if (config.type === 'custom') {
          localUseCustomPrompt.value = true;
          localCustomPrompt.value = config.text || '';
          localAppendToPrompt.value = false;
          localPromptAppend.value = '';
        } else if (config.type === 'preset') {
          localUseCustomPrompt.value = false;
          localCustomPrompt.value = '';
          localAppendToPrompt.value = !!config.append;
          localPromptAppend.value = config.append || '';
        }
      } else {
        localUseCustomPrompt.value = false;
        localCustomPrompt.value = '';
        localAppendToPrompt.value = false;
        localPromptAppend.value = '';
      }
    }
  },
  { immediate: true },
);

// Auto-adjust reasoning effort when model changes
watch(localModel, () => {
  if (isCodexEngine.value) {
    localReasoningEffort.value = normalizedReasoningEffort.value;
  }
});

function getEngineColor(engineName: string): string {
  const colors: Record<string, string> = {
    claude: '#c87941',
    codex: '#10a37f',
    deepseek: '#4f46e5',
    cursor: '#8b5cf6',
    qwen: '#6366f1',
    glm: '#ef4444',
  };
  return colors[engineName] || '#6b7280';
}

function handleClose(): void {
  emit('close');
}

function handleSave(): void {
  // Build systemPromptConfig based on local state
  let systemPromptConfig: AgentSystemPromptConfig | null = null;

  if (localUseCustomPrompt.value && localCustomPrompt.value.trim()) {
    systemPromptConfig = {
      type: 'custom',
      text: localCustomPrompt.value.trim(),
    };
  } else if (localAppendToPrompt.value && localPromptAppend.value.trim()) {
    systemPromptConfig = {
      type: 'preset',
      preset: 'claude_code',
      append: localPromptAppend.value.trim(),
    };
  } else {
    // Use default preset without append
    systemPromptConfig = {
      type: 'preset',
      preset: 'claude_code',
    };
  }

  // Build optionsConfig for Codex engine
  let optionsConfig: AgentSessionOptionsConfig | undefined;
  if (isCodexEngine.value) {
    const existingOptions = props.session?.optionsConfig ?? {};
    const existingCodexConfig = existingOptions.codexConfig ?? {};
    optionsConfig = {
      ...existingOptions,
      codexConfig: {
        ...existingCodexConfig,
        reasoningEffort: normalizedReasoningEffort.value,
      },
    };
  }

  const settings: SessionSettings = {
    model: localModel.value.trim(),
    permissionMode: localPermissionMode.value,
    systemPromptConfig,
    optionsConfig,
  };
  emit('save', settings);
}
</script>
