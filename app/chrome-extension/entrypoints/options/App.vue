<template>
  <div class="page">
    <header class="topbar">
      <h1>{{ m('userscriptsManagerTitle') }}</h1>
      <div class="switch">
        <label>
          <input type="checkbox" v-model="emergencyDisabled" @change="saveEmergency" />
          <span>{{ m('emergencySwitchLabel') }}</span>
        </label>
      </div>
    </header>

    <section class="proxy">
      <h2>住宅代理</h2>
      <p class="description"
        >反向入口 <code>pr.oxylabs.io:7777</code> 在用户名中使用
        <code>cc-us</code>/<code>cc-ca</code>；具体国家入口的 HTTP 为
        <code>us-pr.oxylabs.io:10000</code>/<code>ca-pr.oxylabs.io:30000</code>，HTTPS 为
        <code>:10001</code>/<code>:30001</code>，用户名不带 <code>cc</code>。</p
      >
      <div class="grid">
        <label class="toggle">
          启用代理
          <input type="checkbox" v-model="proxy.enabled" />
        </label>
        <label>
          端点类型
          <select v-model="proxy.endpointType" :disabled="!proxy.enabled">
            <option value="reverse">反向连接入口（7777）</option>
            <option value="country">具体国家/地区入口</option>
          </select>
        </label>
        <label v-if="proxy.endpointType === 'reverse'">
          接入地区
          <select v-model="proxy.accessRegion" :disabled="!proxy.enabled">
            <option value="global">全球（pr.oxylabs.io:7777）</option>
            <option value="beijing">北京（cnt9t1is.com:8000）</option>
            <option value="hongkong">香港（a81298871.com:8000）</option>
            <option value="custom">自定义地址</option>
          </select>
        </label>
        <label>
          输出格式 / 连接协议
          <select v-model="proxy.protocol" :disabled="!proxy.enabled">
            <option value="http">端点：端口 / HTTP</option>
            <option value="https">HTTPS</option>
            <option value="socks5" disabled>SOCKS5（Oxylabs 不支持 Chrome）</option>
          </select>
        </label>
        <label>
          代理地址或完整连接串
          <input
            v-model="proxy.host"
            placeholder="customer-USER:PASSWORD@pr.oxylabs.io:7777"
            :disabled="!proxy.enabled"
          />
        </label>
        <label>
          端口
          <input
            v-model.number="proxy.port"
            type="number"
            min="1"
            max="65535"
            :disabled="!proxy.enabled"
          />
        </label>
        <label>
          用户名
          <input
            v-model="proxy.username"
            placeholder="customer-USERNAME-cc-us-sesstime-5"
            :disabled="!proxy.enabled"
          />
        </label>
        <label>
          国家/地区{{ proxy.endpointType === 'country' ? '' : '（可选）' }}
          <select v-model="proxy.countryCode" :disabled="!proxy.enabled">
            <option v-if="proxy.endpointType === 'reverse'" value="">不指定（保留用户名）</option>
            <option v-if="proxy.endpointType === 'reverse'" value="random">随机（移除 cc）</option>
            <option value="us"
              >美国{{
                proxy.endpointType === 'reverse'
                  ? '（cc-us）'
                  : `（us-pr.oxylabs.io:${proxy.protocol === 'https' ? '10001' : '10000'}）`
              }}</option
            >
            <option value="ca"
              >加拿大{{
                proxy.endpointType === 'reverse'
                  ? '（cc-ca）'
                  : `（ca-pr.oxylabs.io:${proxy.protocol === 'https' ? '30001' : '30000'}）`
              }}</option
            >
          </select>
        </label>
        <label>
          密码
          <input
            v-model="proxy.password"
            type="password"
            autocomplete="new-password"
            :disabled="!proxy.enabled"
          />
        </label>
        <label>
          会话 ID（可选）
          <input v-model="proxy.sessionId" placeholder="0366443321" :disabled="!proxy.enabled" />
        </label>
        <label class="toggle">
          页面异常自动轮换 IP
          <input type="checkbox" v-model="proxy.rotateOnError" :disabled="!proxy.enabled" />
        </label>
      </div>
      <label>
        仅对这些网站走代理（留空表示全部网站）
        <textarea
          v-model="proxyDomains"
          rows="2"
          placeholder="example.com&#10;*.shop.example"
          :disabled="!proxy.enabled"
        />
      </label>
      <div class="row">
        <button :disabled="proxySaving" @click="saveProxy">保存代理设置</button>
        <span class="hint" v-if="proxyResult">{{ proxyResult }}</span>
      </div>
    </section>

    <section class="create">
      <h2>{{ m('createRunSectionTitle') }}</h2>
      <div class="grid">
        <label>
          {{ m('nameLabel') }}
          <input v-model="form.name" :placeholder="m('placeholderOptional')" />
        </label>
        <label>
          {{ m('runAtLabel') }}
          <select v-model="form.runAt">
            <option value="auto">{{ m('runAtAuto') }}</option>
            <option value="document_start">{{ m('runAtDocumentStart') }}</option>
            <option value="document_end">{{ m('runAtDocumentEnd') }}</option>
            <option value="document_idle">{{ m('runAtDocumentIdle') }}</option>
          </select>
        </label>
        <label>
          {{ m('worldLabel') }}
          <select v-model="form.world">
            <option value="auto">{{ m('worldAuto') }}</option>
            <option value="ISOLATED">{{ m('worldIsolated') }}</option>
            <option value="MAIN">{{ m('worldMain') }}</option>
          </select>
        </label>
        <label>
          {{ m('modeLabel') }}
          <select v-model="form.mode">
            <option value="auto">{{ m('modeAuto') }}</option>
            <option value="persistent">{{ m('modePersistent') }}</option>
            <option value="css">{{ m('modeCss') }}</option>
            <option value="once">{{ m('modeOnce') }}</option>
          </select>
        </label>
        <label>
          {{ m('allFramesLabel') }}
          <input type="checkbox" v-model="form.allFrames" />
        </label>
        <label>
          {{ m('persistLabel') }}
          <input type="checkbox" v-model="form.persist" />
        </label>
        <label>
          {{ m('dnrFallbackLabel') }}
          <input type="checkbox" v-model="form.dnrFallback" />
        </label>
      </div>
      <label>
        {{ m('matchesInputLabel') }}
        <input v-model="form.matches" :placeholder="m('placeholderMatchesExample')" />
      </label>
      <label>
        {{ m('excludesInputLabel') }}
        <input v-model="form.excludes" :placeholder="m('placeholderOptional')" />
      </label>
      <label>
        {{ m('tagsInputLabel') }}
        <input v-model="form.tags" :placeholder="m('placeholderOptional')" />
      </label>
      <label>
        {{ m('scriptLabel') }}
        <textarea v-model="form.script" :placeholder="m('placeholderScriptHint')" rows="8" />
      </label>
      <div class="row">
        <button :disabled="submitting" @click="apply('auto')">{{ m('applyButton') }}</button>
        <button :disabled="submitting" @click="apply('once')">{{ m('runOnceButton') }}</button>
        <span class="hint" v-if="lastResult">{{ lastResult }}</span>
      </div>
    </section>

    <section class="filters">
      <h2>{{ m('listSectionTitle') }}</h2>
      <div class="grid">
        <label>
          {{ m('queryLabel') }}
          <input v-model="filters.query" @input="reload()" />
        </label>
        <label>
          {{ m('statusLabel') }}
          <select v-model="filters.status" @change="reload()">
            <option value="">{{ m('statusAll') }}</option>
            <option value="enabled">{{ m('statusEnabled') }}</option>
            <option value="disabled">{{ m('statusDisabled') }}</option>
          </select>
        </label>
        <label>
          {{ m('domainLabel') }}
          <input
            v-model="filters.domain"
            @input="reload()"
            :placeholder="m('placeholderDomainHint')"
          />
        </label>
      </div>
      <div class="row">
        <button @click="exportAll">{{ m('exportAllButton') }}</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>{{ m('tableHeaderName') }}</th>
            <th>{{ m('statusLabel') }}</th>
            <th>{{ m('tableHeaderWorld') }}</th>
            <th>{{ m('tableHeaderRunAt') }}</th>
            <th>{{ m('tableHeaderUpdated') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="it in items" :key="it.id">
            <td>{{ it.name || it.id }}</td>
            <td>
              <label>
                <input type="checkbox" :checked="it.status === 'enabled'" @change="toggle(it)" />
                {{ it.status }}
              </label>
            </td>
            <td>{{ it.world }}</td>
            <td>{{ it.runAt }}</td>
            <td>{{ formatTime(it.updatedAt) }}</td>
            <td class="actions">
              <button @click="remove(it)">{{ m('deleteButton') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Flow Editor removed: unified to Builder in Popup -->
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { STORAGE_KEYS } from '@/common/constants';

type ListItem = {
  id: string;
  name?: string;
  status: 'enabled' | 'disabled';
  world: 'ISOLATED' | 'MAIN';
  runAt: 'document_start' | 'document_end' | 'document_idle';
  updatedAt: number;
};

const emergencyDisabled = ref(false);
const items = ref<ListItem[]>([]);
const filters = ref({ query: '', status: '', domain: '' });
const proxy = reactive({
  enabled: false,
  host: '',
  port: 7777,
  username: '',
  password: '',
  sessionId: '',
  rotateOnError: true,
  countryCode: '',
  endpointType: 'reverse' as 'reverse' | 'country',
  accessRegion: 'global' as 'global' | 'beijing' | 'hongkong' | 'custom',
  protocol: 'http' as 'http' | 'https' | 'socks5',
});
const proxySaving = ref(false);
const proxyResult = ref('');
const proxyDomains = ref('');

const form = ref({
  name: '',
  runAt: 'auto',
  world: 'auto',
  mode: 'auto',
  allFrames: true,
  persist: true,
  dnrFallback: true,
  script: '',
  matches: '',
  excludes: '',
  tags: '',
});

const submitting = ref(false);
const lastResult = ref('');

function formatTime(ts?: number) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

async function saveEmergency() {
  await globalThis.chrome?.storage?.local.set({
    [STORAGE_KEYS.USERSCRIPTS_DISABLED]: emergencyDisabled.value,
  });
}

async function loadProxy() {
  const stored = await globalThis.chrome?.storage?.local.get(STORAGE_KEYS.PROXY_CONFIG);
  const saved = stored?.[STORAGE_KEYS.PROXY_CONFIG] || {};
  Object.assign(proxy, saved);
  if (!Object.hasOwn(saved, 'countryCode')) {
    proxy.countryCode = saved.username?.match(/-cc-([a-z]{2})(?=-|$)/i)?.[1] || '';
  }
  proxyDomains.value = (saved.domains || []).join('\n');
}

async function saveProxy() {
  proxySaving.value = true;
  proxyResult.value = '';
  try {
    const result = await globalThis.chrome?.runtime?.sendMessage({
      type: 'proxy_configure',
      config: {
        ...proxy,
        domains: proxyDomains.value
          .split(/[\n,]/)
          .map((domain) => domain.trim())
          .filter(Boolean),
      },
    });
    if (!result?.success) throw new Error(result?.error || '保存失败');
    Object.assign(proxy, result.config);
    proxyDomains.value = (result.config.domains || []).join('\n');
    proxyResult.value = proxy.enabled ? '代理已启用' : '代理已停用';
  } catch (error: any) {
    proxyResult.value = `错误：${error?.message || String(error)}`;
  } finally {
    proxySaving.value = false;
  }
}

async function loadEmergency() {
  const v = await globalThis.chrome?.storage?.local.get([STORAGE_KEYS.USERSCRIPTS_DISABLED] as any);
  emergencyDisabled.value = !!v[STORAGE_KEYS.USERSCRIPTS_DISABLED];
}

async function callTool(name: string, args: any) {
  const res = await globalThis.chrome?.runtime?.sendMessage({
    type: 'call_tool',
    name,
    args,
  } as any);
  if (!res || !res.success) throw new Error(res?.error || 'call failed');
  return res.result;
}

async function reload() {
  const result = await callTool(TOOL_NAMES.BROWSER.USERSCRIPT, {
    action: 'list',
    args: { ...filters.value },
  });
  try {
    const txt = (result?.content?.[0]?.text as string) || '{}';
    const data = JSON.parse(txt);
    items.value = data.items || [];
  } catch (e) {
    console.warn('parse list failed', e);
  }
}

async function apply(mode: 'auto' | 'once') {
  if (!form.value.script.trim()) return;
  submitting.value = true;
  lastResult.value = '';
  try {
    const args: any = {
      script: form.value.script,
      name: form.value.name || undefined,
      runAt: form.value.runAt as any,
      world: form.value.world as any,
      allFrames: !!form.value.allFrames,
      persist: !!form.value.persist,
      dnrFallback: !!form.value.dnrFallback,
      mode,
    };
    if (form.value.matches.trim())
      args.matches = form.value.matches.split(',').map((s) => s.trim());
    if (form.value.excludes.trim())
      args.excludes = form.value.excludes.split(',').map((s) => s.trim());
    if (form.value.tags.trim()) args.tags = form.value.tags.split(',').map((s) => s.trim());

    const result = await callTool(TOOL_NAMES.BROWSER.USERSCRIPT, { action: 'create', args });
    lastResult.value = (result?.content?.[0]?.text as string) || '';
    await reload();
  } catch (e: any) {
    lastResult.value = 'Error: ' + (e?.message || String(e));
  } finally {
    submitting.value = false;
  }
}

async function toggle(it: ListItem) {
  try {
    await callTool(TOOL_NAMES.BROWSER.USERSCRIPT, {
      action: it.status === 'enabled' ? 'disable' : 'enable',
      args: { id: it.id },
    });
    await reload();
  } catch (e) {
    console.warn('toggle failed', e);
  }
}

async function remove(it: ListItem) {
  try {
    await callTool(TOOL_NAMES.BROWSER.USERSCRIPT, { action: 'remove', args: { id: it.id } });
    await reload();
  } catch (e) {
    console.warn('remove failed', e);
  }
}

async function exportAll() {
  try {
    const res = await callTool(TOOL_NAMES.BROWSER.USERSCRIPT, { action: 'export', args: {} });
    const txt = (res?.content?.[0]?.text as string) || '{}';
    const blob = new Blob([txt], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    await globalThis.chrome?.downloads?.download({
      url,
      filename: 'userscripts-export.json',
      saveAs: true,
    } as any);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn('export failed', e);
  }
}

onMounted(async () => {
  await loadEmergency();
  await loadProxy();
  await reload();
});

function m(key: string, substitutions?: string | string[]) {
  const msg = (globalThis.chrome?.i18n?.getMessage(key, substitutions as any) || '').trim();
  return msg || key;
}
</script>

<style scoped>
.page {
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    Segoe UI,
    Roboto,
    sans-serif;
  padding: 16px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.proxy,
.create,
.filters {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 16px;
}
.description {
  margin: 0 0 12px;
  color: #4b5563;
  font-size: 12px;
}
.toggle input {
  align-self: flex-start;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
label {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  gap: 4px;
}
input,
select,
textarea {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px;
  font-size: 12px;
}
textarea {
  resize: vertical;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
button {
  background: #3b82f6;
  color: #fff;
  border: none;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
}
button:hover {
  background: #2563eb;
}
.hint {
  color: #374151;
  font-size: 12px;
}
.table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}
.table th,
.table td {
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  padding: 8px;
  font-size: 12px;
}
.actions {
  text-align: right;
}
.switch input {
  margin-right: 6px;
}
@media (max-width: 960px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
