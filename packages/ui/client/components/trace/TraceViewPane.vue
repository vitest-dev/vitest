<script setup lang="ts">
import type { TraceSelection } from '~/composables/trace-view'
import { computed } from 'vue'
import IconButton from '~/components/IconButton.vue'
import { closeTrace, getSelectedTrace, getTraceAttemptLabel, getTraceAttemptMap, selectActiveTraceAttempt, showTraceSelectorHighlight } from '~/composables/trace-view'
import TraceView from './TraceView.vue'

const props = defineProps<{
  selection: TraceSelection
}>()

const trace = computed(() => getSelectedTrace(props.selection))
const attemptLabel = computed(() => trace.value ? getTraceAttemptLabel(trace.value) : '')
const traceAttempts = computed(() => [...getTraceAttemptMap(props.selection.test.artifacts)].map(([key, trace]) => ({
  key,
  label: getTraceAttemptLabel(trace) || 'Initial run',
})))
const selectedAttemptKey = computed({
  get: () => props.selection.attemptKey ?? traceAttempts.value[0]?.key ?? '',
  set: selectActiveTraceAttempt,
})
</script>

<template>
  <div data-testid="trace-view" h-full min-h-0 flex="~ col">
    <div p="3" h-10 flex="~ gap-2" items-center bg-header border="b base">
      <div class="i-carbon:data-vis-4" />
      <span pl-1 font-bold text-sm flex-auto ws-nowrap overflow-hidden truncate>Trace Viewer</span>
      <select
        v-if="traceAttempts.length > 1"
        v-model="selectedAttemptKey"
        aria-label="Trace attempt"
        class="max-w-40 cursor-pointer border border-base rounded bg-base px-2 py-1 text-xs"
      >
        <option
          v-for="attempt in traceAttempts"
          :key="attempt.key"
          :value="attempt.key"
        >
          {{ attempt.label }}
        </option>
      </select>
      <span
        v-else-if="attemptLabel"
        class="text-xs opacity-70"
      >
        {{ attemptLabel }}
      </span>
      <label class="flex items-center gap-1 text-xs ws-nowrap select-none cursor-pointer">
        <input
          v-model="showTraceSelectorHighlight"
          type="checkbox"
        >
        <span>Show highlight</span>
      </label>
      <IconButton
        v-tooltip.bottom="'Close Trace Viewer'"
        title="Close Trace Viewer"
        icon="i-carbon:close"
        @click="closeTrace()"
      />
    </div>
    <TraceView
      v-if="trace"
      :trace="trace"
      :selection="selection"
    />
    <div v-else class="text-sm opacity-50 p-4">
      No trace found
    </div>
  </div>
</template>
