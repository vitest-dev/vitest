<script setup lang="ts">
import type { RunnerTestCase } from 'vitest'
import { computed } from 'vue'
import { getTraceAttemptLabel, getTraceAttemptMap, openTrace } from '~/composables/trace-view'

const props = defineProps<{
  test: RunnerTestCase
}>()

const traces = computed(() => {
  const traceMap = getTraceAttemptMap(props.test.artifacts)
  return Object.values(traceMap).map(trace => ({
    trace,
    label: getTraceAttemptLabel(trace),
  }))
})
</script>

<template>
  <template v-if="traces.length">
    <h1 m-2>
      Trace View
    </h1>
    <div
      v-for="{ trace, label } of traces"
      :key="`${trace.repeats}:${trace.retry}`"
      bg="yellow-500/10"
      text="yellow-500 sm"
      p="x3 y2"
      m-2
      rounded
      role="note"
    >
      <button
        data-testid="trace-open-button"
        type="button"
        class="flex items-center gap-2 rounded px-2 py-1 hover:bg-yellow-500/10"
        @click="openTrace(trace, test)"
      >
        <span class="i-carbon:play-outline block" />
        Open trace viewer
        <span v-if="label" class="text-xs opacity-70">
          {{ label }}
        </span>
      </button>
    </div>
  </template>
</template>
