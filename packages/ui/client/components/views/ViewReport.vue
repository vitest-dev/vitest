<script setup lang="ts">
import type { RunnerTask, RunnerTestFile, RunnerTestSuite } from 'vitest'
import { computed } from 'vue'
import { browserState, config } from '~/composables/client'
import { isDark } from '~/composables/dark'
import { mapLeveledTaskStacks } from '~/composables/error'
import { activeFileId, selectedTest } from '~/composables/params'
import { getScreenshotUrls, hasScreenshot, useScreenshot } from '~/composables/screenshot'
import Modal from '../Modal.vue'
import ScreenshotCarousel from '../ScreenshotCarousel.vue'
import StatusBanner from '../StatusBanner.vue'
import ScreenshotError from './ScreenshotError.vue'
import ViewReportError from './ViewReportError.vue'

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
    // For suites/describes, only collect child test failures, not the suite itself
    return task.tasks.flatMap(t => collectFailed(t, level))
  }
}

function collectPassed(task: RunnerTask, level: number): LeveledTask[] {
  if (task.result?.state !== 'pass') {
    return []
  }

  if (task.type === 'test') {
    return [{ ...task, level }]
  }
  else {
    return task.tasks.flatMap(t => collectPassed(t, level + 1))
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

const passed = computed(() => {
  const file = props.file
  return file.tasks?.flatMap(t => collectPassed(t, 0)) ?? []
})

const {
  currentTask,
  showScreenshot,
  showScreenshotModal,
  currentScreenshotUrl,
} = useScreenshot()

function navigateToTest(task: RunnerTask) {
  activeFileId.value = task.file.id
  selectedTest.value = task.id
}

function getFullTestName(task: RunnerTask): string {
  const names: string[] = []
  let current: RunnerTask | undefined = task

  while (current) {
    if (current.type !== 'file') {
      names.unshift(current.name)
    }
    current = current.suite
  }

  return names.join(' > ')
}
</script>

<template>
  <div h-full class="scrolls">
    <template v-if="failed.length">
      <div v-for="task of failed" :id="task.id" :key="task.id" class="test-card">
        <h3 class="test-name" @click="navigateToTest(task)">
          {{ getFullTestName(task) }}
        </h3>
        <StatusBanner :task="task" />
        <!-- Display screenshot when screenshotsInReport is enabled -->
        <div v-if="config.ui.screenshotsInReport && hasScreenshot(task)" p="x3 y2" m-2>
          <ScreenshotCarousel
            :screenshot-urls="getScreenshotUrls(task)"
            :alt="`Screenshot for ${task.name}`"
          />
        </div>
        <!-- Only show error container if there are actual errors -->
        <div
          v-if="task.result?.htmlError || task.result?.errors?.length"
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
      <StatusBanner :file="file" />
      <!-- Display screenshots for passed tests when screenshotsInReport is enabled -->
      <template v-if="config.ui.screenshotsInReport && passed.length">
        <div v-for="task of passed" :id="task.id" :key="task.id" class="test-card">
          <h3 class="test-name" @click="navigateToTest(task)">
            {{ getFullTestName(task) }}
          </h3>
          <StatusBanner :task="task" />
          <div v-if="hasScreenshot(task)" p="x3 y2" m-2>
            <ScreenshotCarousel
              :screenshot-urls="getScreenshotUrls(task)"
              :alt="`Screenshot for ${task.name}`"
            />
          </div>
        </div>
      </template>
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
.test-card {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}

.test-card:last-child {
  border-bottom: none;
}

.test-name {
  margin: 0.5rem 0.5rem 0 0.5rem;
  padding: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  color: var(--color-text);
}

.test-name:hover {
  opacity: 0.7;
}

.task-error {
  --cm-ttc-c-thumb: #ccc;
}
html.dark .task-error {
  --cm-ttc-c-thumb: #444;
}
</style>
