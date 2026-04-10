<script setup lang="ts">
import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import type { BrowserTraceData } from '../../../../browser/src/client/tester/trace'
import IconButton from '~/components/IconButton.vue'
import { getLocationString, openLocation } from '~/composables/location'
import { closeTrace } from '~/composables/trace-view'
import TraceView from './TraceView.vue'

const props = defineProps<{
  trace: BrowserTraceArtifact
  test: RunnerTestCase
}>()

// TODO: review slop (NEVER REMOVE COMMENT)
function getAttemptLabel(trace: BrowserTraceData) {
  const parts: string[] = []
  if (trace.repeats) {
    parts.push(`Repeat ${trace.repeats}`)
  }
  if (trace.retry) {
    parts.push(`Retry ${trace.retry}`)
  }
  return parts[0] || ''
}
</script>

<template>
  <div h-full min-h-0 flex="~ col">
    <div p="3" h-10 flex="~ gap-2" items-center bg-header border="b base">
      <div class="i-carbon:data-vis-4" />
      <span pl-1 font-bold text-sm flex-auto ws-nowrap overflow-hidden truncate>Trace Viewer</span>
      <span
        v-if="getAttemptLabel(props.trace.data as BrowserTraceData)"
        class="text-xs opacity-70"
      >
        {{ getAttemptLabel(props.trace.data as BrowserTraceData) }}
      </span>
      <button
        v-if="props.trace.location"
        type="button"
        class="text-xs opacity-70 truncate hover:opacity-100"
        @click="openLocation(props.test, props.trace.location)"
      >
        {{ getLocationString(props.trace.location) }}
      </button>
      <IconButton
        v-tooltip.bottom="'Close Trace Viewer'"
        title="Close Trace Viewer"
        icon="i-carbon:close"
        @click="closeTrace()"
      />
    </div>
    <TraceView
      :trace="props.trace"
      :test="props.test"
    />
  </div>
</template>
