<script setup lang="ts">
import type { Task } from '#types'
import { activeFileId } from '~/composables/params'

const header = ref(null)
const headerSize = ref<number>(0)
const style = computed(() => {
  const size = headerSize.value
  return size > 0 ? `height: calc(100vh - ${size}px - 1px)` : null
})
useResizeObserver(header, () => {
  const clientHeight = unrefElement(header)?.clientHeight
  headerSize.value = clientHeight ?? 0
})

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
  <div h="full">
    <div ref="header">
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
    </div>

    <div class="scrolls" :style="style">
      <TaskTree
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :nested="nested"
        :search="search"
        :class="activeFileId === task.id ? 'bg-active' : ''"
        :on-item-click="onItemClick"
      />
    </div>
  </div>
</template>
