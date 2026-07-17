<template>
  <div class="mcp-tools-page">
    <div class="page-header">
      <button class="back-button" @click="$emit('back')" title="返回首页">
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span>返回</span>
      </button>
      <h2 class="page-title">MCP 工具清单</h2>
    </div>

    <div class="page-content">
      <input
        v-model="query"
        class="tool-search"
        type="search"
        placeholder="搜索工具名称或说明"
        autofocus
      />
      <p class="tool-count">{{ filteredTools.length }} / {{ TOOL_SCHEMAS.length }} 个工具</p>

      <div class="tool-list">
        <details v-for="tool in filteredTools" :key="tool.name" class="tool-card">
          <summary>
            <code>{{ tool.name }}</code>
            <span>{{ tool.description }}</span>
          </summary>
          <div v-if="getProperties(tool).length" class="tool-params">
            <div v-for="[name, schema] in getProperties(tool)" :key="name" class="tool-param">
              <code>{{ name }}</code>
              <span>{{ schema.type || 'any' }}{{ isRequired(tool, name) ? ' · 必填' : '' }}</span>
              <small v-if="schema.description">{{ schema.description }}</small>
            </div>
          </div>
          <p v-else class="no-params">无参数</p>
        </details>
        <p v-if="!filteredTools.length" class="empty-state">没有匹配的工具</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { TOOL_SCHEMAS } from '@ethanwilkins/chrome-mcp-shared-2026';

defineEmits<{ (e: 'back'): void }>();

const query = ref('');
const filteredTools = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return keyword
    ? TOOL_SCHEMAS.filter((tool) =>
        `${tool.name} ${tool.description}`.toLowerCase().includes(keyword),
      )
    : TOOL_SCHEMAS;
});

type PropertySchema = { type?: string; description?: string };
const getProperties = (tool: Tool) =>
  Object.entries((tool.inputSchema.properties || {}) as Record<string, PropertySchema>);
const isRequired = (tool: Tool, name: string) => (tool.inputSchema.required || []).includes(name);
</script>

<style scoped>
.mcp-tools-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ac-bg, #fafaf9);
}
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--ac-border, #e7e5e4);
  background: var(--ac-surface, #fff);
}
.back-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ac-text-subtle, #78716c);
}
.page-title {
  margin: 0;
  font-size: 16px;
  color: var(--ac-text, #1c1917);
}
.page-content {
  overflow-y: auto;
  padding: 16px;
}
.tool-search {
  width: 100%;
  padding: 9px 12px;
}
.tool-count {
  margin: 8px 0 12px;
  color: var(--ac-text-subtle, #78716c);
  font-size: 12px;
}
.tool-list {
  display: grid;
  gap: 8px;
}
.tool-card {
  border: 1px solid var(--ac-border, #e7e5e4);
  border-radius: 8px;
  background: var(--ac-surface, #fff);
}
.tool-card summary {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  cursor: pointer;
}
.tool-card summary span,
.tool-param small {
  color: var(--ac-text-subtle, #78716c);
  font-size: 12px;
}
.tool-card code,
.tool-param code {
  color: var(--ac-accent, #d97757);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.tool-params {
  border-top: 1px solid var(--ac-border, #e7e5e4);
  padding: 8px 12px;
}
.tool-param {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 8px;
  padding: 6px 0;
}
.tool-param small {
  grid-column: 1 / -1;
}
.tool-param span,
.no-params {
  color: var(--ac-text-subtle, #78716c);
  font-size: 11px;
}
.no-params,
.empty-state {
  margin: 0;
  padding: 10px 12px;
  color: var(--ac-text-subtle, #78716c);
  font-size: 12px;
}
</style>
