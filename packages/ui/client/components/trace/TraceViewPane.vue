<script setup lang="ts">
import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import IconButton from '~/components/IconButton.vue'
import { getLocationString, openLocation } from '~/composables/location'
import { closeTrace } from '~/composables/trace-view'
import TraceView from './TraceView.vue'

defineProps<{
  trace: BrowserTraceArtifact
  test: RunnerTestCase
}>()
</script>

<template>
  <div h-full min-h-0 flex="~ col">
    <div p="3" h-10 flex="~ gap-2" items-center bg-header border="b base">
      <div class="i-carbon:data-vis-4" />
      <span pl-1 font-bold text-sm flex-auto ws-nowrap overflow-hidden truncate>Trace Viewer</span>
      <button
        v-if="trace.location"
        type="button"
        class="text-xs opacity-70 truncate hover:opacity-100"
        @click="openLocation(test, trace.location)"
      >
        {{ getLocationString(trace.location) }}
      </button>
      <IconButton
        v-tooltip.bottom="'Close Trace Viewer'"
        title="Close Trace Viewer"
        icon="i-carbon:close"
        @click="closeTrace()"
      />
    </div>
    <TraceView
      :trace="trace"
      :test="test"
    />
  </div>
</template>
