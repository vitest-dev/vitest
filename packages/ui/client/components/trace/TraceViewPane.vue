<script setup lang="ts">
import type { TraceSelection } from '~/composables/trace-view'
import { computed } from 'vue'
import IconButton from '~/components/IconButton.vue'
import { layoutMode } from '~/composables/params'
import { closeTrace, getSelectedTrace, getTraceAttemptLabel, showTraceSelectorHighlight } from '~/composables/trace-view'
import TraceView from './TraceView.vue'

const props = defineProps<{
  selection: TraceSelection
}>()

const trace = computed(() => getSelectedTrace(props.selection))
const attemptLabel = computed(() => trace.value ? getTraceAttemptLabel(trace.value) : '')
const focusedTraceUrl = computed(() => {
  const url = new URL(globalThis.location.href)
  const params = new URLSearchParams(url.hash.split('?')[1])
  params.set('layout', 'trace')
  params.set('traceStep', String(props.selection.selectedStepIndex))
  if (props.selection.attemptKey) {
    params.set('traceAttempt', props.selection.attemptKey)
  }
  else {
    params.delete('traceAttempt')
  }
  url.hash = `/?${params}`
  return url.href
})
</script>

<template>
  <div data-testid="trace-view" h-full min-h-0 flex="~ col">
    <div p="3" h-10 flex="~ gap-2" items-center bg-header border="b base">
      <div class="i-carbon:data-vis-4" />
      <span pl-1 font-bold text-sm flex-auto ws-nowrap overflow-hidden truncate>Trace Viewer</span>
      <!-- TODO: pane should own attempt selector here? -->
      <span
        v-if="attemptLabel"
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
        <span class="i-carbon:launch" ma block />
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
