<script setup lang="ts">
import { openInEditor, shouldOpenInEditor } from '../../composables/error'
import type { File, Task } from '#types'
import { config } from '~/composables/client'

const props = defineProps<{
  file?: File
}>()

type LeveledTask = Task & {
  level: number
}

function collectFailed(task: Task, level: number): LeveledTask[] {
  if (task.result?.state !== 'fail')
    return []

  if (task.type === 'test')
    return [{ ...task, level }]
  else
    return [{ ...task, level }, ...task.tasks.flatMap(t => collectFailed(t, level + 1))]
}

const failed = computed(() => props.file?.tasks.flatMap(t => collectFailed(t, 0)) || [])

function relative(p: string) {
  if (p.startsWith(config.value.root))
    return p.slice(config.value.root.length)
  return p
}
</script>

<template>
  <div h-full class="scrolls">
    <template v-if="failed.length">
      <div v-for="task of failed" :key="task.id">
        <div bg="red-500/10" text="red-500 sm" p="x3 y2" m-2 rounded :style="{ 'margin-left': `${2 * task.level + 0.5}rem`}">
          {{ task.name }}
          <div v-if="task.result?.error" class="scrolls scrolls-rounded task-error">
            <pre><b>{{ task.result.error.name || task.result.error.nameStr }}</b>: {{ task.result.error.message }}</pre>
            <div v-for="({ file: efile, line, column }, i) of task.result.error.stacks || []" :key="i" class="op80 flex gap-x-2 items-center">
              <pre> - {{ relative(efile) }}:{{ line }}:{{ column }}</pre>
              <div
                v-if="shouldOpenInEditor(efile, props.file?.name)"
                v-tooltip.bottom="'Open in Editor'"
                class="i-carbon-launch c-red-600 dark:c-red-400 hover:cursor-pointer"
                tabindex="0"
                aria-label="Open in Editor"
                @click.passive="openInEditor(efile, line, column)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <div bg="green-500/10" text="green-500 sm" p="x4 y2" m-2 rounded>
        All tests passed in this file
      </div>
    </template>
  </div>
</template>

<style scoped>
.task-error {
  --cm-ttc-c-thumb: #CCC;
}
html.dark .task-error {
  --cm-ttc-c-thumb: #444;
}
</style>
