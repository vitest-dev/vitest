<script setup lang="ts">
import type { Task } from 'vitest'
import { toggleDark } from '~/composables'
import { activeFileIdRef, files, status } from '~/composables/state'

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
          <IconButton
            v-if="status === 'CONNECTING'"
            icon="i-carbon-wifi"
            text-orange-300
          />
          <IconButton
            v-else-if="status === 'CLOSED'"
            icon="i-carbon-wifi-off"
            text-red-300
          />
          <IconButton icon="i-carbon-play" />
          <IconButton
            icon="dark:i-carbon-moon i-carbon-sun"
            @click="toggleDark()"
          />
        </div>
      </template>
    </TasksList>
  </nav>
</template>
