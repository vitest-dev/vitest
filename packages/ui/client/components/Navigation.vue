<script setup lang="ts">
import { injectCurrentModule, injectShowSummary, injectSummaryVisible } from '../composables/navigation'
import { findById } from '../composables/client'
import type { Task } from '#types'
import { toggleDark } from '~/composables'
import { files, runAll } from '~/composables/client'
import { activeFileId } from '~/composables/params'

const summaryVisible = injectSummaryVisible()
const showSummary = injectShowSummary()
const currentModule = injectCurrentModule()

function onItemClick(task: Task) {
  activeFileId.value = task.id
  currentModule.value = findById(task.id)
  showSummary(false)
}
</script>

<template>
  <TasksList
    border="r base"
    :tasks="files"
    :on-item-click="onItemClick"
    :group-by-type="true"
  >
    <template #header>
      <img w-6 h-6 mx-2 src="/favicon.svg">
      <span font-light text-sm flex-1>
        Vitest
      </span>
      <div class="flex text-lg">
        <IconButton v-if="!summaryVisible" icon="i-carbon-dashboard" @click="showSummary(true)" />
        <IconButton icon="i-carbon-play" @click="runAll()" />
        <IconButton
          icon="dark:i-carbon-moon i-carbon-sun"
          @click="toggleDark()"
        />
      </div>
    </template>
  </TasksList>
</template>
