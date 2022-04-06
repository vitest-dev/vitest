<script setup lang="ts">
import { openInEditor, shouldOpenInEditor } from '../../composables/error'
import type { File, Suite, Task } from '#types'
import { config } from '~/composables/client'
import { isDark } from '~/composables/dark'
import { createAnsiToHtmlFilter } from '~/composables/error'

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

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function mapLeveledTaskStacks(dark: boolean, tasks: LeveledTask[]) {
  const filter = createAnsiToHtmlFilter(dark)
  return tasks.map((t) => {
    const result = t.result
    if (result) {
      const error = result.error
      if (error) {
        let uiHtmlError = ''
        if (error.message.includes('\x1B'))
          uiHtmlError = `<b>${error.nameStr || error.name}</b>: ${filter.toHtml(escapeHtml(error.message))}`

        const startStrWithX1B = error.stackStr?.includes('\x1B')
        if (startStrWithX1B || error.stack?.includes('\x1B')) {
          if (uiHtmlError.length > 0)
            uiHtmlError += filter.toHtml(escapeHtml((startStrWithX1B ? error.stackStr : error.stack) as string))
          else
            uiHtmlError = `<b>${error.nameStr || error.name}</b>: ${error.message}${filter.toHtml(escapeHtml((startStrWithX1B ? error.stackStr : error.stack) as string))}`
        }

        if (uiHtmlError.length > 0)
          result.uiHtmlError = uiHtmlError
      }
    }
    return t
  })
}

const failed = computed(() => {
  const file = props.file
  const failedFlatMap = file?.tasks?.flatMap(t => collectFailed(t, 0)) ?? []
  const result = file?.result
  const fileError = result?.error
  // we must check also if the test cannot compile
  if (fileError) {
    // create a dummy one
    const fileErrorTask: Suite & { level: number } = {
      id: file!.id,
      name: file!.name,
      level: 0,
      type: 'suite',
      mode: 'run',
      tasks: [],
      result,
    }
    failedFlatMap.unshift(fileErrorTask)
  }
  return failedFlatMap.length > 0 ? mapLeveledTaskStacks(isDark.value, failedFlatMap) : failedFlatMap
})

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
        <div
          bg="red-500/10"
          text="red-500 sm"
          p="x3 y2"
          m-2
          rounded
          :style="{ 'margin-left': `${task.result?.uiHtmlError ? 0.5 : (2 * task.level + 0.5)}rem`}"
        >
          {{ task.name }}
          <div v-if="task.result?.uiHtmlError" class="scrolls scrolls-rounded task-error">
            <pre v-html="task.result.uiHtmlError" />
          </div>
          <div v-else-if="task.result?.error" class="scrolls scrolls-rounded task-error">
            <pre><b>{{ task.result.error.name || task.result.error.nameStr }}</b>: {{ task.result.error.message }}</pre>
            <div v-for="({ file: efile, line, column }, i) of task.result.error.stacks || []" :key="i" class="op80 flex gap-x-2 items-center">
              <pre> - {{ relative(efile) }}:{{ line }}:{{ column }}</pre>
              <div
                v-if="shouldOpenInEditor(efile, props.file?.name)"
                v-tooltip.bottom="'Open in Editor'"
                class="i-carbon-launch c-red-600 dark:c-red-400 hover:cursor-pointer min-w-1em min-h-1em"
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
