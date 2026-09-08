<script setup lang="ts">
import type { RunnerTask } from 'vitest'
import type { TraceSelection } from '~/composables/trace-view'
import { computed } from 'vue'
import IconButton from '~/components/IconButton.vue'
import { layoutMode, params } from '~/composables/params'
import { closeTrace, getSelectedTrace, getTraceAttemptLabel, showTraceSelectorHighlight } from '~/composables/trace-view'
import TraceView from './TraceView.vue'

const props = defineProps<{
  selection: TraceSelection
}>()

const trace = computed(() => getSelectedTrace(props.selection))
const attemptLabel = computed(() => trace.value ? getTraceAttemptLabel(trace.value) : '')
const traceTitle = computed(() => {
  const suites: string[] = []
  let task: RunnerTask | undefined = props.selection.test.suite
  while (task) {
    suites.unshift(task.name)
    task = task.suite
  }
  const context = [props.selection.test.file.name, ...suites]
  return {
    context: context.join(' > '),
    full: [...context, props.selection.test.name].join(' > '),
  }
})
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
  <div data-testid="trace-view" h-full min-h-0 flex="~ col">
    <div p="3" h-10 flex="~ gap-2" items-center bg-header border="b base">
      <div class="i-carbon:data-vis-4" />
      <div
        v-if="layoutMode === 'trace'"
        data-testid="trace-view-title"
        :title="traceTitle.full"
        pl-1 text-sm flex-auto min-w-0 ws-nowrap overflow-hidden truncate
      >
        <span font-bold>{{ selection.test.name }}</span>
        <span v-if="traceTitle.context" ml-2 op-50>{{ traceTitle.context }}</span>
      </div>
      <span v-else data-testid="trace-view-title" pl-1 font-bold text-sm flex-auto>Trace Viewer</span>
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
