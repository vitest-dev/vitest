<script setup lang="ts">
import type { RunnerTask, RunnerTestFile, RunnerTestSuite } from 'vitest'
import { computed } from 'vue'
import { config } from '~/composables/client'
import FailureScreenshot from '../FailureScreenshot.vue'
import ViewReportError from './ViewReportError.vue'

const props = defineProps<{
  suite: RunnerTestFile | RunnerTestSuite
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
  const suite = props.suite
  const failedFlatMap = suite.tasks.flatMap(t => collectFailed(t, 0))
  // append suite level errors as same indent level as children errors
  if (suite.result?.errors?.length) {
    const taskError: LeveledTask = {
      ...suite,
      level: 0,
      tasks: [],
    }
    failedFlatMap.unshift(taskError)
  }
  return failedFlatMap
})

const isFile = computed(() => 'filepath' in props.suite)
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
            'margin-left': `${2 * (task as LeveledTask).level + 0.5}rem`,
          }"
        >
          <div flex="~ gap-2 items-center">
            <span>{{ task.name }}</span>
            <FailureScreenshot :task="task" />
          </div>
          <template v-if="task.result?.errors && config.root">
            <ViewReportError
              v-for="(error, idx) of task.result.errors"
              :key="idx"
              :error="error"
              :filename="task.file.name"
              :root="config.root"
              :file-id="task.file.id"
            />
          </template>
        </div>
      </div>
    </template>
    <template v-else>
      <div bg="green-500/10" text="green-500 sm" p="x4 y2" m-2 rounded>
        All tests passed in this {{ isFile ? 'file' : 'suite' }}
      </div>
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
