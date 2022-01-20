<script setup lang="ts">
import { hasFailedSnapshot } from '@vitest/ws-client'
import { currentModule, dashboardVisible, showDashboard } from '../composables/navigation'
import { client, findById } from '../composables/client'
import type { Task } from '#types'
import { isDark, toggleDark } from '~/composables'
import { files, runAll } from '~/composables/client'
import { activeFileId } from '~/composables/params'

const failedSnapshot = computed(() => files.value && hasFailedSnapshot(files.value))
const updateSnapshot = () => client.rpc.updateSnapshot()

function onItemClick(task: Task) {
  activeFileId.value = task.id
  currentModule.value = findById(task.id)
  showDashboard(false)
}
const toggleMode = computed(() => isDark.value ? 'light' : 'dark')

</script>

<template>
  <TasksList border="r base" :tasks="files" :on-item-click="onItemClick" :group-by-type="true" @run="runAll">
    <template #header="{ filteredTests }">
      <img w-6 h-6 mx-2 src="/favicon.svg">
      <span font-light text-sm flex-1>Vitest</span>
      <div class="flex text-lg">
        <IconButton
          v-show="!dashboardVisible"
          v-tooltip.bottom="'Dashboard'"
          title="Show dashboard"
          class="!animate-100ms"
          animate-count-1
          icon="i-carbon-dashboard"
          @click="showDashboard(true)"
        />
        <IconButton
          v-if="failedSnapshot"
          v-tooltip.bottom="'Update all failed snapshot(s)'"
          icon="i-carbon-result-old"
          @click="updateSnapshot()"
        />
        <IconButton
          v-tooltip.bottom="filteredTests ? (filteredTests.length === 0 ? 'No test to run (clear filter)' : 'Rerun filtered') : 'Rerun all'"
          :disabled="filteredTests?.length === 0"
          icon="i-carbon-play"
          @click="runAll(filteredTests)"
        />
        <IconButton
          v-tooltip.bottom="`Toggle to ${toggleMode} mode`"
          icon="dark:i-carbon-moon i-carbon-sun"
          @click="toggleDark()"
        />
      </div>
    </template>
  </TasksList>
</template>
