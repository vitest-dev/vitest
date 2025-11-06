<script setup lang="ts">
import type { RunnerTask, RunnerTestFile } from 'vitest'
import { computed } from 'vue'

const props = defineProps<{
  task?: RunnerTask
  file?: RunnerTestFile
  message?: string
  clickable?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const state = computed(() => {
  const item = props.task || props.file
  if (!item) {
    return 'pass'
  }

  // Check if skipped
  if (item.result?.state === 'skip' || item.mode === 'skip' || item.mode === 'todo') {
    return 'skip'
  }

  // Check if running
  if (item.result?.state === 'run') {
    return 'run'
  }

  // Check if failed
  if (item.result?.state === 'fail') {
    return 'fail'
  }

  // Default to pass
  return 'pass'
})

const statusClass = computed(() => {
  switch (state.value) {
    case 'fail': return 'status-banner-fail'
    case 'run': return 'status-banner-run'
    case 'skip': return 'status-banner-skip'
    default: return 'status-banner-pass'
  }
})

const defaultMessage = computed(() => {
  if (props.message) {
    return props.message
  }

  const isFile = !!props.file

  switch (state.value) {
    case 'fail':
      return isFile ? 'Tests failed in this file' : 'Test failed'
    case 'run':
      return isFile ? 'Tests are running...' : 'Test is running...'
    case 'skip':
      return isFile ? 'All tests were skipped in this file' : 'Test was skipped'
    default:
      return isFile ? 'All tests passed in this file' : 'Test passed'
  }
})
</script>

<template>
  <div
    p="x4 y2"
    m-2
    rounded
    text="sm"
    :class="[statusClass, clickable ? 'status-banner-clickable' : '']"
    @click="clickable ? emit('click') : undefined"
  >
    {{ defaultMessage }}
  </div>
</template>

<style scoped>
.status-banner-pass {
  background: var(--status-pass-bg);
  color: var(--status-pass-text);
}

.status-banner-fail {
  background: var(--status-fail-bg);
  color: var(--status-fail-text);
}

.status-banner-skip {
  background: var(--status-skip-bg);
  color: var(--status-skip-text);
}

.status-banner-run {
  background: var(--status-run-bg);
  color: var(--status-run-text);
}

.status-banner-clickable {
  cursor: pointer;
  transition: opacity 0.2s;
}

.status-banner-clickable:hover {
  opacity: 0.8;
}
</style>
