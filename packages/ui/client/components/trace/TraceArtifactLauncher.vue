<script setup lang="ts">
import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import type { BrowserTraceData } from '../../../../browser/src/client/tester/trace'
import { computed } from 'vue'
import { openTrace } from '~/composables/trace-view'
import { getTraceAttemptLabel } from './utils'

const props = defineProps<{
  trace: BrowserTraceArtifact
  test: RunnerTestCase
}>()

const attemptLabel = computed(() => getTraceAttemptLabel(props.trace.data as BrowserTraceData))
</script>

<template>
  <button
    type="button"
    class="flex items-center gap-2 rounded px-2 py-1 hover:bg-yellow-500/10"
    @click="openTrace(trace, test)"
  >
    <span class="i-carbon:play-outline block" />
    Open trace viewer
    <span v-if="attemptLabel" class="text-xs opacity-70">
      {{ attemptLabel }}
    </span>
  </button>
</template>
