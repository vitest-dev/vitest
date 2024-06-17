<script setup lang="ts">
import type { Task, TaskState } from '@vitest/runner'
import { hasFailedSnapshot } from '@vitest/ws-client'
import { isReport } from '~/constants'
import { client } from '~/composables/client'
import type { TaskTreeNodeType } from '~/composables/explorer/types'

const props = defineProps<{
  taskId: string
  name: string
  typecheck?: boolean
  duration?: number
  projectName?: string
  projectNameColor: string
  type: TaskTreeNodeType
  state?: TaskState
  opened: boolean
  current: boolean
}>()

const emit = defineEmits<{
  (event: 'preview', value: Task): void
  (event: 'run', value: Task): void
  (event: 'fixSnapshot', value: Task): void
}>()

const task = computed(() => {
  return client.state.idMap.get(props.taskId)
})

const failedSnapshot = computed(() => task.value && hasFailedSnapshot(task.value))
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
    :aria-label="name"
    :data-current="current"
  >
    <div v-if="type === 'suite'" pr-1>
      <div :class="opened ? 'i-carbon-chevron-down' : 'i-carbon-chevron-right op20'" op20 />
    </div>
    <StatusIcon :task="task" mr-2 />
    <div v-if="type === 'suite' && typecheck" class="i-logos:typescript-icon" flex-shrink-0 mr-2 />
    <div flex items-end gap-2 :text="state === 'fail' ? 'red-500' : ''" overflow-hidden>
      <span text-sm truncate font-light>
        <!-- only show [] in files view -->
        <span v-if="type === 'file' && projectName" :style="{ color: projectNameColor }">
          [{{ projectName }}]
        </span>
        {{ name }}
      </span>
      <span v-if="typeof duration === 'number'" text="xs" op20 style="white-space: nowrap">
        {{ duration > 0 ? duration : '< 1' }}ms
      </span>
    </div>
    <div v-if="type === 'file'" gap-1 justify-end flex-grow-1 pl-1 class="test-actions">
      <IconAction
        v-if="!isReport && failedSnapshot"
        v-tooltip.bottom="'Fix failed snapshot(s)'"
        data-testid="btn-fix-snapshot"
        title="Fix failed snapshot(s)"
        icon="i-carbon-result-old"
        @click.prevent.stop="emit('fixSnapshot', task)"
      />
      <IconAction
        v-tooltip.bottom="'Open test details'"
        data-testid="btn-open-details"
        title="Open test details"
        icon="i-carbon-intrusion-prevention"
        @click.prevent.stop="emit('preview', task)"
      />
      <IconAction
        v-if="!isReport"
        v-tooltip.bottom="'Run current test'"
        data-testid="btn-run-test"
        title="Run current test"
        icon="i-carbon:play-filled-alt"
        text-green5
        @click.prevent.stop="emit('run', task)"
      />
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
