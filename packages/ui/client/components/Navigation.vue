<script setup lang="ts">
import { injectCurrentModule, injectShowSummary } from '../composables/navigation'
import { findById } from '../composables/client'
import type { Task } from '#types'
import { toggleDark } from '~/composables'
import { files, runAll } from '~/composables/client'
import { activeFileId } from '~/composables/params'

const currentModule = injectCurrentModule()
const showSummary = injectShowSummary()

function onItemClick(task: Task) {
  activeFileId.value = task.id
  currentModule.value = findById(task.id)
}
function runAllAndShowSummary() {
  runAll()
  showSummary()
}
</script>

<template>
  <nav border="r base">
    <TasksList
      :tasks="files"
      :on-item-click="onItemClick"
    >
      <template #header>
        <img cursor-pointer w-6 h-6 mx-2 src="/favicon.svg" @click="showSummary">
        <span font-light text-sm flex-1>
          Vitest
        </span>
        <div class="flex text-lg">
          <IconButton icon="i-carbon-play" @click="runAllAndShowSummary()" />
          <IconButton
            icon="dark:i-carbon-moon i-carbon-sun"
            @click="toggleDark()"
          />
        </div>
      </template>
    </TasksList>
  </nav>
</template>
