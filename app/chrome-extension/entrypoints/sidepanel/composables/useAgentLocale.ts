import { computed, ref } from 'vue';

export type AgentLocale = 'zh' | 'en';

const STORAGE_KEY = 'agent-chat-locale';
const locale = ref<AgentLocale>(localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'zh');

export function useAgentLocale() {
  const isChinese = computed(() => locale.value === 'zh');

  function setLocale(next: AgentLocale): void {
    locale.value = next;
    localStorage.setItem(STORAGE_KEY, next);
  }

  return { locale, isChinese, setLocale };
}
