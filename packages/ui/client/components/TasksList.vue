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

const props = withDefaults(defineProps<{
  tasks: Task[]
  indent?: number
  nested?: boolean
  groupByType?: boolean
  onItemClick?: (task: Task) => void
}>(), {
  indent: 0,
  groupByType: false,
  nested: false,
})

const search = ref('')

const filtered = computed(() => {
  if (!search.value)
    return props.tasks
  return props.tasks.filter(task => task.name.match(search.value))
})
const failed = computed(() => filtered.value.filter(task => task.result?.state === 'fail'))
const success = computed(() => filtered.value.filter(task => task.result?.state === 'pass'))
const skipped = computed(() => filtered.value.filter(task => task.mode === 'skip' || task.mode === 'todo'))
const running = computed(() => filtered.value.filter(task =>
  !failed.value.includes(task)
  && !success.value.includes(task)
  && !skipped.value.includes(task),
))
</script>

<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>

<template>
  <div h="full" flex="~ col">
    <div>
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

    <div class="scrolls" flex-auto py-1>
      <template v-if="groupByType">
        <DetailsPanel v-if="failed.length">
          <template #summary>
            <div text-red5>
              FAIL ({{ failed.length }})
            </div>
          </template>
          <TaskTree
            v-for="task in failed"
            :key="task.id"
            :task="task"
            :nested="nested"
            :search="search"
            :indent="1"
            :class="activeFileId === task.id ? 'bg-active' : ''"
            :on-item-click="onItemClick"
          />
        </DetailsPanel>
        <DetailsPanel v-if="running.length">
          <template #summary>
            <div text-yellow5>
              RUNNING ({{ running.length }})
            </div>
          </template>
          <TaskTree
            v-for="task in running"
            :key="task.id"
            :task="task"
            :nested="nested"
            :search="search"
            :indent="1"
            :class="activeFileId === task.id ? 'bg-active' : ''"
            :on-item-click="onItemClick"
          />
        </DetailsPanel>
        <DetailsPanel v-if="success.length">
          <template #summary>
            <div text-green5>
              PASS ({{ success.length }})
            </div>
          </template>
          <TaskTree
            v-for="task in success"
            :key="task.id"
            :task="task"
            :nested="nested"
            :search="search"
            :indent="1"
            :class="activeFileId === task.id ? 'bg-active' : ''"
            :on-item-click="onItemClick"
          />
        </DetailsPanel>
        <DetailsPanel v-if="skipped.length">
          <template #summary>
            <div text-purple5:50>
              SKIP ({{ skipped.length }})
            </div>
          </template>
          <TaskTree
            v-for="task in skipped"
            :key="task.id"
            :task="task"
            :nested="nested"
            :search="search"
            :indent="1"
            :class="activeFileId === task.id ? 'bg-active' : ''"
            :on-item-click="onItemClick"
          />
        </DetailsPanel>
      </template>

      <!--flat-->
      <template v-else>
        <TaskTree
          v-for="task in filtered"
          :key="task.id"
          :task="task"
          :nested="nested"
          :search="search"
          :class="activeFileId === task.id ? 'bg-active' : ''"
          :on-item-click="onItemClick"
        />
      </template>
    </div>
  </div>
</template>
