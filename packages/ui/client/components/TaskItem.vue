<script setup lang="ts">
import type { Task } from 'vitest'

const props = defineProps<{
  task: Task
}>()

const duration = computed(() => {
  const { result } = props.task
  return result && Math.round(result.duration || 0)
})

function getProjectNameColor(name: string | undefined) {
  if (!name)
    return ''
  const index = name.split('').reduce((acc, v, idx) => acc + v.charCodeAt(0) + idx, 0)
  const colors = [
    'blue',
    'yellow',
    'cyan',
    'green',
    'magenta',
  ]
  return colors[index % colors.length]
}

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
  >
    <StatusIcon :task="task" mr-2 />
    <div v-if="task.type === 'suite' && task.meta.typecheck" i-logos:typescript-icon flex-shrink-0 mr-2 />
    <div flex items-end gap-2 :text="task?.result?.state === 'fail' ? 'red-500' : ''">
      <span text-sm truncate font-light>
        <!-- only show [] in files view -->
        <span v-if="task.filepath && task.file.projectName" :style="{ color: getProjectNameColor(task.file.projectName) }">
          [{{ task.file.projectName }}]
        </span>
        {{ task.name }}
      </span>
      <span v-if="typeof duration === 'number'" text="xs" op20 style="white-space: nowrap">
        {{ duration > 0 ? duration : '< 1' }}ms
      </span>
    </div>
  </div>
</template>
