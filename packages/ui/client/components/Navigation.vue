<script setup lang="ts">
import type { Task } from '#types'
import { toggleDark } from '~/composables'
import { files, runAll } from '~/composables/client'
import { activeFileId } from '~/composables/params'

function onItemClick(task: Task) {
  activeFileId.value = task.id
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
        <IconButton icon="i-carbon-play" @click="runAll()" />
        <IconButton
          icon="dark:i-carbon-moon i-carbon-sun"
          @click="toggleDark()"
        />
      </div>
    </template>
  </TasksList>
</template>
