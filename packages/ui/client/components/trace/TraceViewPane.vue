<script setup lang="ts">
import type { TraceSelection } from '~/composables/trace-view'
import { computed } from 'vue'
import IconButton from '~/components/IconButton.vue'
import { layoutMode, params } from '~/composables/params'
import { closeTrace, getSelectedTrace, getTraceAttemptLabel, getTraceAttemptMap, selectActiveTraceAttempt, showTraceSelectorHighlight } from '~/composables/trace-view'
import { getNames } from '../../../../vitest/src/utils/tasks.ts'
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
  get: () => props.selection.attemptKey ?? '0:0',
  set: selectActiveTraceAttempt,
})
const traceContext = computed(() => getNames(props.selection.test).slice(0, -1).join(' > '))
const focusedTraceUrl = computed(() => {
  const url = new URL(globalThis.location.href)
  const focusedParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value != null) {
      focusedParams.set(key, String(value))
    }
  }
  focusedParams.set('layout', 'trace')
  url.hash = `/?${focusedParams}`
  return url.href
})
</script>

<template>
  <div data-testid="trace-view" class="h-full min-h-0 flex flex-col">
    <div class="h-10 flex items-center gap-2 border-b border-base bg-header p-3">
      <div class="i-carbon:data-vis-4" />
      <div
        v-if="layoutMode === 'trace'"
        data-testid="trace-view-title"
        class="min-w-0 flex-auto overflow-hidden truncate ws-nowrap pl-1 text-sm"
      >
        <span class="font-bold">{{ selection.test.name }}</span>
        <span v-if="traceContext" class="ml-2 op-50">{{ traceContext }}</span>
      </div>
      <span v-else data-testid="trace-view-title" class="flex-auto pl-1 text-sm font-bold">Trace Viewer</span>
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
      <a
        v-if="layoutMode !== 'trace'"
        v-tooltip.bottom="'Open Trace Viewer in New Tab'"
        :href="focusedTraceUrl"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open Trace Viewer in New Tab"
        class="w-1.4em h-1.4em flex op70 rounded hover:bg-active hover:op100"
      >
        <span class="i-carbon:launch m-auto block" />
      </a>
      <IconButton
        v-if="layoutMode !== 'trace'"
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
