<script setup lang="ts">
import type { RunnerTestCase } from 'vitest'
import { computed } from 'vue'
import { getTraceAttemptMap, openTrace } from '~/composables/trace-view'

const props = defineProps<{
  test: RunnerTestCase
}>()

const hasTrace = computed(() => getTraceAttemptMap(props.test.artifacts).size > 0)
</script>

<template>
  <button
    v-if="hasTrace"
    data-testid="trace-open-button"
    type="button"
    class="m-2 flex items-center gap-2 rounded bg-yellow-500/10 px-3 py-2 text-sm text-yellow-500 hover:bg-yellow-500/20"
    @click="openTrace(test)"
  >
    <span class="i-carbon:play-outline block" />
    Open trace viewer
  </button>
</template>
