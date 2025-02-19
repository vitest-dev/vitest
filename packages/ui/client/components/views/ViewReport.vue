<script setup lang="ts">
import type Convert from 'ansi-to-html'
import type { ErrorWithDiff, File, Suite, Task } from 'vitest'
import { browserState, config } from '~/composables/client'
import { isDark } from '~/composables/dark'
import { createAnsiToHtmlFilter } from '~/composables/error'
import { selectedTest } from '~/composables/params'
import { escapeHtml } from '~/utils/escape'

const props = defineProps<{
  file?: File
}>()

type LeveledTask = Task & {
  level: number
}

function collectFailed(task: Task, level: number): LeveledTask[] {
  if (task.result?.state !== 'fail') {
    return []
  }

  if (task.type === 'test') {
    return [{ ...task, level }]
  }
  else {
    return [
      { ...task, level },
      ...task.tasks.flatMap(t => collectFailed(t, level + 1)),
    ]
  }
}

function createHtmlError(filter: Convert, error: ErrorWithDiff) {
  let htmlError = ''
  if (error.message?.includes('\x1B')) {
    htmlError = `<b>${error.nameStr || error.name}</b>: ${filter.toHtml(
      escapeHtml(error.message),
    )}`
  }

  const startStrWithX1B = error.stackStr?.includes('\x1B')
  if (startStrWithX1B || error.stack?.includes('\x1B')) {
    if (htmlError.length > 0) {
      htmlError += filter.toHtml(
        escapeHtml((startStrWithX1B ? error.stackStr : error.stack) as string),
      )
    }
    else {
      htmlError = `<b>${error.nameStr || error.name}</b>: ${
        error.message
      }${filter.toHtml(
        escapeHtml((startStrWithX1B ? error.stackStr : error.stack) as string),
      )}`
    }
  }

  if (htmlError.length > 0) {
    return htmlError
  }
  return null
}

function mapLeveledTaskStacks(dark: boolean, tasks: LeveledTask[]) {
  const filter = createAnsiToHtmlFilter(dark)
  return tasks.map((t) => {
    const result = t.result
    if (!result) {
      return t
    }
    const errors = result.errors
      ?.map(error => createHtmlError(filter, error))
      .filter(error => error != null)
      .join('<br><br>')
    if (errors?.length) {
      result.htmlError = errors
    }
    return t
  })
}

const failed = computed(() => {
  const file = props.file
  const failedFlatMap = file?.tasks?.flatMap(t => collectFailed(t, 0)) ?? []
  const result = file?.result
  const fileError = result?.errors?.[0]
  // we must check also if the test cannot compile
  if (fileError) {
    // create a dummy one
    const fileErrorTask: Suite & { level: number } = {
      id: file!.id,
      file: file!,
      name: file!.name,
      level: 0,
      type: 'suite',
      mode: 'run',
      meta: {},
      tasks: [],
      result,
    }
    failedFlatMap.unshift(fileErrorTask)
  }
  return failedFlatMap.length > 0
    ? mapLeveledTaskStacks(isDark.value, failedFlatMap)
    : failedFlatMap
})

function open(task: Task) {
  const filePath = task.meta?.failScreenshotPath
  if (filePath) {
    fetch(`/__open-in-editor?file=${encodeURIComponent(filePath)}`)
  }
}

const showScreenshot = ref(false)
const timestamp = ref(Date.now())
const currentTask = ref<Task | undefined>()
const currentScreenshotUrl = computed(() => {
  const id = currentTask.value?.id
  // force refresh
  const t = timestamp.value
  // browser plugin using /, change this if base can be modified
  return id ? `/__screenshot-error?id=${encodeURIComponent(id)}&t=${t}` : undefined
})

function showScreenshotModal(task: Task) {
  currentTask.value = task
  timestamp.value = Date.now()
  showScreenshot.value = true
}

watch(() => [selectedTest.value] as const, ([test]) => {
  if (test != null) {
    // Have to wrap the selector in [id=''] since #{test} will produce an invalid selector because the test ID is a number
    const testElement = document.querySelector(`[id='${test}'`)
    if (testElement != null) {
      nextTick(() => {
        testElement.scrollIntoView()
      })
    }
  }
}, { flush: 'post' })
</script>

<template>
  <div h-full class="scrolls">
    <template v-if="failed.length">
      <div v-for="task of failed" :id="task.id" :key="task.id">
        <div
          bg="red-500/10"
          text="red-500 sm"
          p="x3 y2"
          m-2
          rounded
          :style="{
            'margin-left': `${
              task.result?.htmlError ? 0.5 : 2 * task.level + 0.5
            }rem`,
          }"
        >
          <div flex="~ gap-2 items-center">
            <span>{{ task.name }}</span>
            <template v-if="browserState && task.meta?.failScreenshotPath">
              <IconButton
                v-tooltip.bottom="'View screenshot error'"
                class="!op-100"
                icon="i-carbon:image"
                title="View screenshot error"
                @click="showScreenshotModal(task)"
              />
              <IconButton
                v-tooltip.bottom="'Open screenshot error in editor'"
                class="!op-100"
                icon="i-carbon:image-reference"
                title="Open screenshot error in editor"
                @click="open(task)"
              />
            </template>
          </div>
          <div
            v-if="task.result?.htmlError"
            class="scrolls scrolls-rounded task-error"
            data-testid="task-error"
          >
            <pre v-html="task.result.htmlError" />
          </div>
          <template v-else-if="task.result?.errors">
            <ViewReportError
              v-for="(error, idx) of task.result.errors"
              :key="idx"
              :error="error"
              :filename="file?.name"
              :root="config.root"
            />
          </template>
        </div>
      </div>
    </template>
    <template v-else>
      <div bg="green-500/10" text="green-500 sm" p="x4 y2" m-2 rounded>
        All tests passed in this file
      </div>
    </template>
    <template v-if="browserState">
      <Modal v-model="showScreenshot" direction="right">
        <template v-if="currentTask">
          <Suspense>
            <ScreenshotError
              :file="currentTask.file.filepath"
              :name="currentTask.name"
              :url="currentScreenshotUrl"
              @close="showScreenshot = false"
            />
          </Suspense>
        </template>
      </Modal>
    </template>
  </div>
</template>

<style scoped>
.task-error {
  --cm-ttc-c-thumb: #ccc;
}
html.dark .task-error {
  --cm-ttc-c-thumb: #444;
}
</style>
