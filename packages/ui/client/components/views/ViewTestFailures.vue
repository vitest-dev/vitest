<script setup lang="ts">
import type { RunnerTestCase } from 'vitest'
import type { SeedDetail, TestFailureReport } from '../../../../vitest/src/types/general'
import { useClipboard } from '@vueuse/core'
import { ref } from 'vue'
import ViewReportError from './ViewReportError.vue'

defineProps<{
  test: RunnerTestCase
  report: TestFailureReport
  root: string
}>()

const { copy, copied } = useClipboard({ legacy: true })
const copiedDetail = ref<string>()

const copyLabels: Partial<Record<SeedDetail['key'], string>> = {
  Keep: 'Copy the test option',
  Replay: 'Copy the replay command',
}

function copyDetail(failureIndex: number, detail: SeedDetail) {
  copiedDetail.value = `${failureIndex} ${detail.key}`
  return copy(detail.copy ?? detail.value)
}

function isCopied(failureIndex: number, detail: SeedDetail) {
  return copied.value && copiedDetail.value === `${failureIndex} ${detail.key}`
}
</script>

<template>
  <div
    v-for="(failure, idx) of report.failures"
    :key="idx"
    data-testid="test-failure"
    :class="{ 'border-t border-red-500/25 mt-3 pt-3': idx > 0 }"
  >
    <ViewReportError
      :error="failure.error"
      :file-id="test.file.id"
      :filename="test.file.name"
      :root="root"
    />
    <dl
      v-if="failure.details.length"
      class="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 mt-2 mb-1 pt-2 border-t border-dashed border-red-500/25 font-mono text-xs text-gray-700 dark:text-gray-300"
      data-testid="failure-details"
    >
      <template v-for="detail of failure.details" :key="detail.key">
        <dt class="op60 text-right">{{ detail.key }}</dt>
        <dd
          class="m-0 flex items-start gap-2 min-w-0"
          :class="{ 'text-yellow-700 dark:text-yellow-400': detail.warning }"
        >
          <code class="break-words whitespace-pre-wrap">{{ detail.value }}</code>
          <button
            v-if="copyLabels[detail.key]"
            type="button"
            :aria-label="copyLabels[detail.key]"
            class="flex-none flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-500/30 font-sans hover:bg-hover"
            @click="copyDetail(idx, detail)"
          >
            <span :class="isCopied(idx, detail) ? 'i-carbon:checkmark' : 'i-carbon:copy'" />
            {{ isCopied(idx, detail) ? 'Copied' : 'Copy' }}
          </button>
        </dd>
      </template>
    </dl>
  </div>
</template>
