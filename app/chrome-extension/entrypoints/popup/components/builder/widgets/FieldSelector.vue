<template>
  <div class="selector">
    <div class="row">
      <input class="form-input" :placeholder="placeholder" :value="text" @input="onInput" />
      <button class="btn-mini" type="button" title="Pick from page" @click="onPick">Pick</button>
      <button class="btn-mini" type="button" :disabled="validating" @click="onValidate">
        {{ validating ? 'Validating…' : 'Validate locator' }}
      </button>
    </div>
    <div class="help">Enter a CSS selector, or click "Pick" to choose an element on the page</div>
    <div v-if="message" :class="validationOk ? 'success-item' : 'error-item'">{{ message }}</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watchEffect } from 'vue';
import { pickElementFromPage, validatePageSelector } from '../components/page-picker';
const props = defineProps<{ modelValue?: string; field?: any }>();
const emit = defineEmits<{ (e: 'update:modelValue', v?: string): void }>();
const text = ref<string>(props.modelValue ?? '');
const placeholder = props.field?.placeholder || '.btn.primary';
function onInput(ev: any) {
  const v = String(ev?.target?.value ?? '');
  text.value = v;
  emit('update:modelValue', v);
}
watchEffect(() => (text.value = props.modelValue ?? ''));

const message = ref('');
const validationOk = ref(false);
const validating = ref(false);

async function onPick() {
  try {
    message.value = '';
    const res: any = await pickElementFromPage();
    if (!res || !res.success) {
      if (res?.cancelled) return;
      throw new Error(res?.error || 'Pick failed');
    }
    const candidates = Array.isArray(res.candidates) ? res.candidates : [];
    const prefer = ['css', 'attr', 'aria', 'text'];
    let sel = '';
    for (const t of prefer) {
      const c = candidates.find((x: any) => x.type === t && x.value);
      if (c) {
        sel = String(c.value);
        break;
      }
    }
    if (!sel && candidates[0]?.value) sel = String(candidates[0].value);
    if (sel) {
      text.value = sel;
      emit('update:modelValue', sel);
    } else {
      validationOk.value = false;
      message.value = 'No valid selector generated; enter one manually';
    }
  } catch (e: any) {
    validationOk.value = false;
    message.value = e?.message || String(e);
  }
}

async function onValidate() {
  validating.value = true;
  try {
    await validatePageSelector(text.value);
    validationOk.value = true;
    message.value = 'Located successfully.';
  } catch (e: any) {
    validationOk.value = false;
    message.value = e?.message || String(e);
  } finally {
    validating.value = false;
  }
}
</script>

<style scoped>
.row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.btn-mini {
  font-size: 12px;
  padding: 2px 6px;
  border: 1px solid var(--rr-border);
  border-radius: 6px;
}
.error-item {
  font-size: 12px;
  color: #ff6666;
  margin-top: 6px;
}
.success-item {
  font-size: 12px;
  color: #059669;
  margin-top: 6px;
}
</style>
