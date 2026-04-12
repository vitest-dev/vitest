<script setup lang="ts">
import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import type { BrowserTraceData } from '../../../../browser/src/client/tester/trace'
import { openTrace } from '~/composables/trace-view'

defineProps<{
  trace: BrowserTraceArtifact
  test: RunnerTestCase
}>()

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
  <button
    type="button"
    class="flex items-center gap-2 rounded px-2 py-1 hover:bg-yellow-500/10"
    @click="openTrace(trace, test)"
  >
    <span class="i-carbon:play-outline block" />
    Open trace viewer
    <span v-if="getAttemptLabel(trace.data as BrowserTraceData)" class="text-xs opacity-70">
      {{ getAttemptLabel(trace.data as BrowserTraceData) }}
    </span>
  </button>
</template>
