<script setup lang="ts">
import type { RunnerTestFile } from 'vitest'
import { Tooltip as VueTooltip } from 'floating-vue'
import { computed, nextTick } from 'vue'
import { isDark, toggleDark } from '~/composables'
import { client, config, isReport, runAll, runFiles } from '~/composables/client'
import { explorerTree } from '~/composables/explorer'
import { initialized, shouldShowExpandAll } from '~/composables/explorer/state'
import {
  clickOnTask,
  coverageConfigured,
  coverageEnabled,
  coverageVisible,
  dashboardVisible,
  disableCoverage,
  showCoverage,
  showDashboard,
} from '~/composables/navigation'
import Explorer from './explorer/Explorer.vue'
import IconButton from './IconButton.vue'

function updateSnapshot() {
  return client.rpc.updateSnapshot()
}

const toggleMode = computed(() => isDark.value ? 'light' : 'dark')

async function onRunAll(files?: RunnerTestFile[]) {
  if (config.value.api?.allowExec === false) {
    return
  }

  if (coverageEnabled.value) {
    disableCoverage.value = true
    await nextTick()
    if (coverageVisible.value) {
      showDashboard(true)
      await nextTick()
    }
  }
  if (files?.length) {
    await runFiles(files)
  }
  else {
    await runAll()
  }
}

function collapseTests() {
  explorerTree.collapseAllNodes()
}

function expandTests() {
  explorerTree.expandAllNodes()
}

function getRerunTooltip(filteredFiles: RunnerTestFile[] | undefined) {
  if (config.value.api?.allowExec === false) {
    return 'Cannot run tests when `api.allowExec` is `false`. Did you expose UI to the internet?'
  }
  return filteredFiles ? (filteredFiles.length === 0 ? 'No test to run (clear filter)' : 'Rerun filtered') : 'Rerun all'
}
</script>

<template>
  <!-- TODO: have test tree so the folders are also nested: test -> filename -> suite -> test -->
  <Explorer border="r base" :on-item-click="clickOnTask" :nested="true" @run="onRunAll">
    <template #header="{ filteredFiles }">
      <img w-6 h-6 src="/favicon.svg" alt="Vitest logo">
      <span font-light text-sm flex-1>Vitest</span>
      <div class="flex text-lg">
        <IconButton
          v-show="!shouldShowExpandAll"
          v-tooltip.bottom="'Collapse tests'"
          title="Collapse tests"
          :disabled="!initialized"
          data-testid="collapse-all"
          icon="i-carbon:collapse-all"
          @click="collapseTests()"
        />
        <IconButton
          v-show="shouldShowExpandAll"
          v-tooltip.bottom="'Expand tests'"
          :disabled="!initialized"
          title="Expand tests"
          data-testid="expand-all"
          icon="i-carbon:expand-all"
          @click="expandTests()"
        />
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
          v-if="(explorerTree.summary.failedSnapshot && !isReport && config.api?.allowExec && config.api?.allowWrite)"
          v-tooltip.bottom="'Update all failed snapshot(s)'"
          icon="i-carbon:result-old"
          :disabled="!explorerTree.summary.failedSnapshotEnabled"
          @click="explorerTree.summary.failedSnapshotEnabled && updateSnapshot()"
        />
        <IconButton
          v-if="!isReport"
          v-tooltip.bottom="getRerunTooltip(filteredFiles)"
          :disabled="filteredFiles?.length === 0 || !config.api?.allowExec"
          icon="i-carbon:play"
          data-testid="btn-run-all"
          @click="onRunAll(filteredFiles)"
        />
        <IconButton
          v-tooltip.bottom="`Toggle to ${toggleMode} mode`"
          icon="dark:i-carbon-moon i-carbon:sun"
          @click="toggleDark()"
        />
      </div>
    </template>
  </Explorer>
</template>
