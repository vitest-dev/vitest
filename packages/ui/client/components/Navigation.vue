<script setup lang="ts">
import type { Task } from '#types'
import { toggleDark } from '~/composables'
import { activeFileIdRef, files, runAll } from '~/composables/client'

function onItemClick(task: Task) {
  activeFileIdRef.value = task.id
}
</script>

<template>
  <nav border="r base">
    <TasksList
      :tasks="files"
      :on-item-click="onItemClick"
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
  </nav>
</template>
