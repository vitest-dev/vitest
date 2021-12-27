<script setup lang="ts">
import type { Task } from 'vitest'
import { activeFileIdRef } from '~/composables/state'

withDefaults(defineProps<{
  tasks: Task[]
  indent?: number
  nested?: boolean
  onItemClick?: (task: Task) => void
}>(), {
  indent: 0,
  nested: false,
})

const search = ref('')
</script>

<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>

<template>
  <div flex="~ col" h="full" overflow="hidden">
    <div
      p="2"
      h-10
      flex="~ gap-2"
      items-center
      bg-header
      border="b base"
    >
      <slot name="header" />
    </div>
    <div
      p="x4 y2"
      flex="~ gap-2"
      items-center
      bg-header
      border="b base"
    >
      <div i-carbon:search flex-shrink-0 />
      <input
        v-model="search"
        placeholder="Search..."
        outline="none"
        bg="transparent"
        font="light"
        text="sm"
        :op="search.length ? '100' : '50'"
      >
    </div>

    <div overflow="auto">
      <TaskTree
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :nested="nested"
        :search="search"
        :class="activeFileIdRef === task.id ? 'bg-active' : ''"
        :on-item-click="onItemClick"
      />
    </div>
  </div>
</template>
