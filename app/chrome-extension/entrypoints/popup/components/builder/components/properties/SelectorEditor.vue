<template>
  <div class="form-section">
    <div class="section-header">
      <span class="section-title">{{ title || '选择器' }}</span>
      <button v-if="allowPick" class="btn-sm btn-primary" @click="pickFromPage">从页面选择</button>
      <button class="btn-sm" :disabled="validating" @click="validateLocator">
        {{ validating ? '验证中…' : '验证定位' }}
      </button>
    </div>
    <div class="selector-list" data-field="target.candidates">
      <div class="selector-item" v-for="(c, i) in list" :key="i">
        <select class="form-select-sm" v-model="c.type">
          <option value="css">CSS</option>
          <option value="attr">Attr</option>
          <option value="aria">ARIA</option>
          <option value="text">Text</option>
          <option value="xpath">XPath</option>
        </select>
        <input class="form-input-sm flex-1" v-model="c.value" placeholder="选择器值" />
        <button class="btn-icon-sm" @click="move(i, -1)" :disabled="i === 0">↑</button>
        <button class="btn-icon-sm" @click="move(i, 1)" :disabled="i === list.length - 1">↓</button>
        <button class="btn-icon-sm danger" @click="remove(i)">×</button>
      </div>
      <button class="btn-sm" @click="add">+ 添加选择器</button>
    </div>
    <div
      v-if="validationMessage"
      :class="['validation-message', validationOk ? 'success' : 'error']"
    >
      {{ validationMessage }}
    </div>
  </div>
</template>

<script lang="ts" setup>
/* eslint-disable vue/no-mutating-props */
import type { NodeBase } from '@/entrypoints/background/record-replay-v3/builder-types';
import { ref } from 'vue';
import { pickElementFromPage, validatePageSelector } from '../page-picker';

const props = defineProps<{
  node: NodeBase;
  allowPick?: boolean;
  targetKey?: string;
  title?: string;
}>();
const key = (props.targetKey || 'target') as string;
const validating = ref(false);
const validationOk = ref(false);
const validationMessage = ref('');

function ensureTarget() {
  const n: any = props.node;
  if (!n.config) n.config = {};
  if (!n.config[key]) n.config[key] = { candidates: [] };
  if (!Array.isArray(n.config[key].candidates)) n.config[key].candidates = [];
}

const list = {
  get value() {
    ensureTarget();
    return ((props.node as any).config[key].candidates || []) as Array<{
      type: string;
      value: string;
    }>;
  },
} as any as Array<{ type: string; value: string }>;

function add() {
  ensureTarget();
  (props.node as any).config[key].candidates.push({ type: 'css', value: '' });
}
function remove(i: number) {
  ensureTarget();
  (props.node as any).config[key].candidates.splice(i, 1);
}
function move(i: number, d: number) {
  ensureTarget();
  const arr = (props.node as any).config[key].candidates as any[];
  const j = i + d;
  if (j < 0 || j >= arr.length) return;
  const t = arr[i];
  arr[i] = arr[j];
  arr[j] = t;
}

async function pickFromPage() {
  try {
    const resp: any = await pickElementFromPage();
    if (!resp || !resp.success) return;
    ensureTarget();
    const n: any = props.node;
    const arr = Array.isArray(resp.candidates) ? resp.candidates : [];
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const c of arr) {
      if (!c || !c.type || !c.value) continue;
      const key = `${c.type}|${c.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({ type: String(c.type), value: String(c.value) });
      }
    }
    n.config[key].candidates = merged;
  } catch (e) {
    validationOk.value = false;
    validationMessage.value = e instanceof Error ? e.message : '拾取失败。';
  }
}

async function validateLocator() {
  ensureTarget();
  const target: any = (props.node as any).config[key];
  const candidates = Array.isArray(target?.candidates) ? target.candidates : [];
  const candidate = target?.selector
    ? { type: 'css', value: target.selector }
    : candidates.find((item: any) => ['css', 'attr', 'xpath'].includes(item.type) && item.value);
  validating.value = true;
  try {
    await validatePageSelector(String(candidate?.value || ''), String(candidate?.type || 'css'));
    validationOk.value = true;
    validationMessage.value = '定位成功。';
  } catch (e) {
    validationOk.value = false;
    validationMessage.value = e instanceof Error ? e.message : '定位失败。';
  } finally {
    validating.value = false;
  }
}
</script>

<style scoped>
/* No local styles; inherit from parent panel via :deep selectors */
.validation-message {
  margin-top: 6px;
  font-size: 12px;
}
.validation-message.success {
  color: #059669;
}
.validation-message.error {
  color: #dc2626;
}
</style>
