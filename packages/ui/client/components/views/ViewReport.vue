<script setup lang="ts">
import type { RunnerTask, RunnerTestFile, RunnerTestSuite } from 'vitest'
import { browserState, config } from '~/composables/client'
import { isDark } from '~/composables/dark'
import { mapLeveledTaskStacks } from '~/composables/error'
import { openScreenshot, useScreenshot } from '~/composables/screenshot'

const props = defineProps<{
  file: RunnerTestFile
}>()

type LeveledTask = RunnerTask & {
  level: number
}

function collectFailed(task: RunnerTask, level: number): LeveledTask[] {
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

const failed = computed(() => {
  const file = props.file
  const failedFlatMap = file.tasks?.flatMap(t => collectFailed(t, 0)) ?? []
  const result = file.result
  const fileError = result?.errors?.[0]
  // we must check also if the test cannot compile
  if (fileError) {
    // create a dummy one
    const fileErrorTask: RunnerTestSuite & { level: number } = {
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

const {
  currentTask,
  showScreenshot,
  showScreenshotModal,
  currentScreenshotUrl,
} = useScreenshot()
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
              task.result?.htmlError ? 0.5 : 2 * (task as LeveledTask).level + 0.5
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
                @click="openScreenshot(task)"
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
              :filename="file.name"
              :root="config.root"
              :file-id="file.id"
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
