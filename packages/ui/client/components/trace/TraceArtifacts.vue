<script setup lang="ts">
import type { RunnerTestCase } from 'vitest'
import { computed } from 'vue'
import { getTraceAttempts } from '~/composables/trace-view'
import TraceArtifactLauncher from './TraceArtifactLauncher.vue'

const props = defineProps<{
  test: RunnerTestCase
}>()

const traces = computed(() => getTraceAttempts(props.test))
</script>

<template>
  <template v-if="traces.length">
    <h1 m-2>
      Trace View
    </h1>
    <div
      v-for="trace of traces"
      :key="`${trace.data.repeats}:${trace.data.retry}`"
      bg="yellow-500/10"
      text="yellow-500 sm"
      p="x3 y2"
      m-2
      rounded
      role="note"
    >
      <TraceArtifactLauncher :trace="trace" :test="test" />
    </div>
  </template>
</template>
