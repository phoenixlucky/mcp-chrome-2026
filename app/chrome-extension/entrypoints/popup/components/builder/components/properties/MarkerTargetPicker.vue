<template>
  <div class="marker-picker">
    <label class="form-label">Use saved marker (optional)</label>
    <select v-model="pageScope" class="form-input" aria-label="Marker page scope">
      <option value="page">Markers on current page</option>
      <option value="all">All markers</option>
    </select>
    <select class="form-input" :value="markerId" @change="selectMarker">
      <option value="">Manual selector</option>
      <option v-for="marker in visibleMarkers" :key="marker.id" :value="marker.id">
        {{ marker.groupName ? `${marker.groupName} / ` : '' }}{{ marker.name }}
      </option>
    </select>
    <select
      v-if="selectedMarker && selectedMarker.members.length > 1 && !allowAll"
      class="form-input"
      :value="memberId"
      @change="selectMember"
    >
      <option value="">Select a marker element</option>
      <option v-for="member in selectedMarker.members" :key="member.id" :value="member.id">
        {{ member.name }}
      </option>
    </select>
    <label v-if="selectedMarker && allowAll" class="marker-all">
      <input type="checkbox" v-model="allMembers" /> Extract all elements in the group
    </label>
    <div v-if="loadError" class="marker-error">{{ loadError }}</div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import { getElementMarkerMembers, type ElementMarker } from '@/common/element-marker-types';
import type { NodeBase } from '@/entrypoints/background/record-replay-v3/builder-types';

const props = withDefaults(
  defineProps<{ node: NodeBase; targetKey?: string; allowAll?: boolean }>(),
  {
    targetKey: 'target',
    allowAll: false,
  },
);
const markers = ref<Array<ElementMarker & { members: ReturnType<typeof getElementMarkerMembers> }>>(
  [],
);
const loadError = ref('');
const pageScope = ref<'page' | 'all'>('page');
const currentPageUrl = ref('');
const config = computed(() => ((props.node as any).config ||= {}));
const target = computed(() => config.value[props.targetKey] || { candidates: [] });
const markerId = computed(() =>
  String(props.allowAll ? config.value.markerId || '' : target.value.markerId || ''),
);
const memberId = computed(() =>
  String(props.allowAll ? config.value.memberId || '' : target.value.memberId || ''),
);
const allMembers = computed({
  get: () => config.value.extractAllMembers === true,
  set: (value: boolean) => {
    config.value.extractAllMembers = value;
    if (value) config.value.memberId = '';
  },
});
const selectedMarker = computed(() => markers.value.find((item) => item.id === markerId.value));
const visibleMarkers = computed(() => {
  if (pageScope.value === 'all' || !currentPageUrl.value) return markers.value;
  let current: URL;
  try {
    current = new URL(currentPageUrl.value);
  } catch {
    return markers.value;
  }
  return markers.value.filter((marker) => {
    if (marker.matchType === 'host') return marker.host === current.hostname;
    if (marker.origin !== current.origin) return false;
    return marker.matchType === 'exact'
      ? marker.path === current.pathname
      : current.pathname.startsWith(marker.path || '/');
  });
});

function selectMarker(event: Event) {
  const id = (event.target as HTMLSelectElement).value;
  if (props.allowAll) {
    config.value.markerId = id;
    config.value.memberId = '';
    config.value.extractAllMembers = false;
  } else {
    config.value[props.targetKey] ||= { candidates: [] };
    target.value.markerId = id || undefined;
    target.value.memberId = undefined;
  }
}
function selectMember(event: Event) {
  const id = (event.target as HTMLSelectElement).value;
  if (props.allowAll) config.value.memberId = id || undefined;
  else {
    config.value[props.targetKey] ||= { candidates: [] };
    target.value.memberId = id || undefined;
  }
}

onMounted(async () => {
  try {
    const [result, tabs] = await Promise.all([
      chrome.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_LIST_ALL }),
      chrome.tabs.query({ active: true, lastFocusedWindow: true }),
    ]);
    if (!result?.success) throw new Error(result?.error || 'Failed to read marker list');
    currentPageUrl.value = String(tabs[0]?.url || '');
    markers.value = (result.markers || []).map((marker: ElementMarker) => ({
      ...marker,
      members: getElementMarkerMembers(marker),
    }));
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error);
  }
});
</script>

<style scoped>
.marker-picker {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
}
.marker-all {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.marker-error {
  color: #dc2626;
  font-size: 12px;
}
</style>
