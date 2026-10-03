<template>
  <div class="form-section">
    <div class="form-group checkbox-group">
      <label class="checkbox-label"
        ><input type="checkbox" v-model="cfg.enabled" /> Enable trigger</label
      >
    </div>
    <div class="form-group">
      <label class="form-label">Description (optional)</label>
      <input
        class="form-input"
        v-model="cfg.description"
        placeholder="Describe what this trigger is for"
      />
    </div>
  </div>

  <div class="divider"></div>

  <div class="form-section">
    <div class="section-header"><span class="section-title">Trigger modes</span></div>
    <div class="form-group checkbox-group">
      <label class="checkbox-label"
        ><input type="checkbox" v-model="cfg.modes.manual" /> Manual</label
      >
      <label class="checkbox-label"
        ><input type="checkbox" v-model="cfg.modes.url" /> Visit URL</label
      >
      <label class="checkbox-label"
        ><input type="checkbox" v-model="cfg.modes.contextMenu" /> Context menu</label
      >
      <label class="checkbox-label"
        ><input type="checkbox" v-model="cfg.modes.command" /> Keyboard shortcut</label
      >
      <label class="checkbox-label"
        ><input type="checkbox" v-model="cfg.modes.dom" /> DOM change</label
      >
      <label class="checkbox-label"
        ><input type="checkbox" v-model="cfg.modes.schedule" /> Schedule</label
      >
    </div>
  </div>

  <div v-if="cfg.modes.url" class="form-section">
    <div class="section-title">Visit URL match</div>
    <div class="selector-list">
      <div v-for="(r, i) in urlRules" :key="i" class="selector-item">
        <select class="form-select-sm" v-model="r.kind">
          <option value="url">URL prefix</option>
          <option value="domain">Domain contains</option>
          <option value="path">Path prefix</option>
        </select>
        <input
          class="form-input-sm flex-1"
          v-model="r.value"
          placeholder="e.g. https://example.com/app"
        />
        <button class="btn-icon-sm" @click="move(urlRules, i, -1)" :disabled="i === 0">↑</button>
        <button
          class="btn-icon-sm"
          @click="move(urlRules, i, 1)"
          :disabled="i === urlRules.length - 1"
          >↓</button
        >
        <button class="btn-icon-sm danger" @click="urlRules.splice(i, 1)">×</button>
      </div>
    </div>
    <button class="btn-sm" @click="urlRules.push({ kind: 'url', value: '' })">+ Add match</button>
  </div>

  <div v-if="cfg.modes.contextMenu" class="form-section">
    <div class="section-title">Context menu</div>
    <div class="form-group">
      <label class="form-label">Title</label>
      <input class="form-input" v-model="cfg.contextMenu.title" placeholder="Menu title" />
    </div>
    <div class="form-group">
      <label class="form-label">Scope</label>
      <div class="checkbox-group">
        <label class="checkbox-label" v-for="c in menuContexts" :key="c">
          <input type="checkbox" :value="c" v-model="cfg.contextMenu.contexts" /> {{ c }}
        </label>
      </div>
    </div>
  </div>

  <div v-if="cfg.modes.command" class="form-section">
    <div class="section-title">Keyboard shortcut</div>
    <div class="form-group">
      <label class="form-label">Command key (must be predeclared in manifest commands)</label>
      <input
        class="form-input"
        v-model="cfg.command.commandKey"
        placeholder="e.g. run_quick_trigger_1"
      />
    </div>
    <div class="text-xs text-slate-500" style="padding: 0 20px"
      >Note: Chrome extension shortcuts must be declared statically in the manifest; they cannot be
      added dynamically at runtime.</div
    >
  </div>

  <div v-if="cfg.modes.dom" class="form-section">
    <div class="section-title">DOM change</div>
    <div class="form-group">
      <label class="form-label">Selector</label>
      <input class="form-input" v-model="cfg.dom.selector" placeholder="#app .item" />
    </div>
    <div class="form-group checkbox-group">
      <label class="checkbox-label"
        ><input type="checkbox" v-model="cfg.dom.appear" /> Trigger on appear</label
      >
      <label class="checkbox-label"
        ><input type="checkbox" v-model="cfg.dom.once" /> Trigger once only</label
      >
    </div>
    <div class="form-group">
      <label class="form-label">Debounce (ms)</label>
      <input class="form-input" type="number" min="0" v-model.number="cfg.dom.debounceMs" />
    </div>
  </div>

  <div v-if="cfg.modes.schedule" class="form-section">
    <div class="section-title">Schedule</div>
    <div class="selector-list">
      <div v-for="(s, i) in schedules" :key="i" class="selector-item">
        <select class="form-select-sm" v-model="s.type">
          <option value="interval">Interval (min)</option>
          <option value="daily">Daily (HH:mm)</option>
          <option value="once">Once (ISO time)</option>
        </select>
        <input
          class="form-input-sm flex-1"
          v-model="s.when"
          placeholder="5 or 09:00 or 2025-01-01T10:00:00"
        />
        <label class="checkbox-label"><input type="checkbox" v-model="s.enabled" /> Enabled</label>
        <button class="btn-icon-sm" @click="move(schedules, i, -1)" :disabled="i === 0">↑</button>
        <button
          class="btn-icon-sm"
          @click="move(schedules, i, 1)"
          :disabled="i === schedules.length - 1"
          >↓</button
        >
        <button class="btn-icon-sm danger" @click="schedules.splice(i, 1)">×</button>
      </div>
    </div>
    <button class="btn-sm" @click="schedules.push({ type: 'interval', when: '5', enabled: true })"
      >+ Add schedule</button
    >
  </div>

  <div class="divider"></div>
  <div class="form-section">
    <div class="text-xs text-slate-500" style="padding: 0 20px"
      >Note: triggers are synced to the background trigger table (URL/context menu/shortcut/DOM) and
      scheduled tasks (interval/daily/once) when the workflow is saved.
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { NodeBase } from '@/entrypoints/background/record-replay-v3/builder-types';

const props = defineProps<{ node: NodeBase }>();

function ensure() {
  const n: any = props.node;
  if (!n.config) n.config = {};
  if (!n.config.modes)
    n.config.modes = {
      manual: true,
      url: false,
      contextMenu: false,
      command: false,
      dom: false,
      schedule: false,
    };
  if (!n.config.url) n.config.url = { rules: [] };
  if (!n.config.contextMenu)
    n.config.contextMenu = { title: 'Run workflow', contexts: ['all'], enabled: false };
  if (!n.config.command) n.config.command = { commandKey: '', enabled: false };
  if (!n.config.dom)
    n.config.dom = { selector: '', appear: true, once: true, debounceMs: 800, enabled: false };
  if (!Array.isArray(n.config.schedules)) n.config.schedules = [];
}

const cfg = computed<any>({
  get() {
    ensure();
    return (props.node as any).config;
  },
  set(v) {
    (props.node as any).config = v;
  },
});

const urlRules = computed({
  get() {
    ensure();
    return (props.node as any).config.url.rules as Array<any>;
  },
  set(v) {
    (props.node as any).config.url.rules = v;
  },
});

const schedules = computed({
  get() {
    ensure();
    return (props.node as any).config.schedules as Array<any>;
  },
  set(v) {
    (props.node as any).config.schedules = v;
  },
});

const menuContexts = ['all', 'page', 'selection', 'image', 'link', 'video', 'audio'];

function move(arr: any[], i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return;
  const t = arr[i];
  arr[i] = arr[j];
  arr[j] = t;
}
</script>

<style scoped></style>
