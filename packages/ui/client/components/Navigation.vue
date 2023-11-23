<script setup lang="ts">
import { hasFailedSnapshot } from '@vitest/ws-client'
import { Tooltip as VueTooltip } from 'floating-vue'
import type { File, Task } from 'vitest'
import {
  coverageConfigured,
  coverageEnabled,
  coverageVisible,
  currentModule,
  dashboardVisible,
  disableCoverage,
  showCoverage,
  showDashboard,
} from '../composables/navigation'
import { client, findById } from '../composables/client'
import { isDark, toggleDark } from '~/composables'
import { files, isReport, runAll } from '~/composables/client'
import { activeFileId } from '~/composables/params'

const failedSnapshot = computed(() => files.value && hasFailedSnapshot(files.value))
function updateSnapshot() {
  return client.rpc.updateSnapshot()
}

const toggleMode = computed(() => isDark.value ? 'light' : 'dark')

function onItemClick(task: Task) {
  activeFileId.value = task.id
  currentModule.value = findById(task.id)
  showDashboard(false)
}

async function onRunAll(files?: File[]) {
  if (coverageEnabled.value) {
    disableCoverage.value = true
    await nextTick()
    if (coverageVisible.value) {
      showDashboard(true)
      await nextTick()
    }
  }
  await runAll(files)
}
</script>

<template>
  <TasksList border="r base" :tasks="files" :on-item-click="onItemClick" :group-by-type="true" @run="onRunAll">
    <template #header="{ filteredTests }">
      <img w-6 h-6 src="/favicon.svg" alt="Vitest logo">
      <span font-light text-sm flex-1>Vitest</span>
      <div class="flex text-lg">
        <IconButton
          v-show="(coverageConfigured && !coverageEnabled) || !dashboardVisible"
          v-tooltip.bottom="'Dashboard'"
          title="Show dashboard"
          class="!animate-100ms"
          animate-count-1
          icon="i-carbon:dashboard"
          @click="showDashboard(true)"
        />
        <VueTooltip
          v-if="coverageConfigured && !coverageEnabled"
          title="Coverage enabled but missing html reporter"
          class="w-1.4em h-1.4em op100 rounded flex color-red5 dark:color-#f43f5e cursor-help"
        >
          <div class="i-carbon:folder-off ma" />
          <template #popper>
            <div class="op100 gap-1 p-y-1" grid="~ items-center cols-[1.5em_1fr]">
              <div class="i-carbon:information-square w-1.5em h-1.5em" />
              <div>Coverage enabled but missing html reporter.</div>
              <div style="grid-column: 2">
                Add html reporter to your configuration to see coverage here.
              </div>
            </div>
          </template>
        </VueTooltip>
        <IconButton
          v-if="coverageEnabled"
          v-show="!coverageVisible"
          v-tooltip.bottom="'Coverage'"
          :disabled="disableCoverage"
          title="Show coverage"
          class="!animate-100ms"
          animate-count-1
          icon="i-carbon:folder-details-reference"
          @click="showCoverage()"
        />
        <IconButton
          v-if="(failedSnapshot && !isReport)"
          v-tooltip.bottom="'Update all failed snapshot(s)'"
          icon="i-carbon:result-old"
          @click="updateSnapshot()"
        />
        <IconButton
          v-if="!isReport"
          v-tooltip.bottom="filteredTests ? (filteredTests.length === 0 ? 'No test to run (clear filter)' : 'Rerun filtered') : 'Rerun all'"
          :disabled="filteredTests?.length === 0"
          icon="i-carbon:play"
          @click="onRunAll(filteredTests)"
        />
        <IconButton
          v-tooltip.bottom="`Toggle to ${toggleMode} mode`"
          icon="dark:i-carbon-moon i-carbon:sun"
          @click="toggleDark()"
        />
      </div>
    </template>
  </TasksList>
</template>
