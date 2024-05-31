<script setup lang="ts">
import type { Task } from 'vitest'
import { getProjectNameColor } from '~/utils/task';
import { activeFileId } from '~/composables/params';

const props = defineProps<{
  task: Task
  opened: boolean
}>()

const emit = defineEmits<{
  run: []
  preview: []
}>()

const duration = computed(() => {
  const { result } = props.task
  return result && Math.round(result.duration || 0)
})
</script>

<template>
  <div
    v-if="task"
    flex="~ row"
    items-center
    p="x-2 y-1"
    border-rounded
    cursor-pointer
    hover="bg-active"
    class="item-wrapper"
    :data-current="activeFileId === task.id"
  >
    <div v-if="task.type === 'suite'" pr-1>
      <div v-if="opened" i-carbon-chevron-down op20 />
      <div v-else i-carbon-chevron-right op20 />
    </div>
    <StatusIcon :task="task" mr-2 />
    <div v-if="task.type === 'suite' && task.meta.typecheck" i-logos:typescript-icon flex-shrink-0 mr-2 />
    <div flex items-end gap-2 :text="task?.result?.state === 'fail' ? 'red-500' : ''" overflow-hidden>
      <span text-sm truncate font-light>
        <!-- only show [] in files view -->
        <span v-if="'filepath' in task && task.projectName" :style="{ color: getProjectNameColor(task.file.projectName) }">
          [{{ task.file.projectName }}]
        </span>
        {{ task.name }}
      </span>
      <span v-if="typeof duration === 'number'" text="xs" op20 style="white-space: nowrap">
        {{ duration > 0 ? duration : '< 1' }}ms
      </span>
    </div>
    <div v-if="task.type === 'suite'" gap-1 justify-end flex-grow-1 pl-1 class="test-actions">
      <div 
        v-if="'filepath' in task" 
        bg="gray-200" 
        rounded-1 
        p-0.5
        @click.prevent.stop="emit('preview')"
      >
        <div i-carbon-intrusion-prevention op50></div>
      </div>

      <div 
        v-if="'filepath' in task" 
        bg="gray-200" 
        rounded-1 
        p-0.5 
        @click.prevent.stop="emit('run')"
      >
        <div i-carbon-play-filled-alt text="green-500" op50></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.test-actions {
  display: none;
}

.item-wrapper:hover .test-actions,
.item-wrapper[data-current="true"] .test-actions {
  display: flex;
}
</style>