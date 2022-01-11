<script setup lang="ts">
import type { Task, Test } from 'vitest/src'
import { files, isConnected } from '~/composables/client'

type Nullable<T> = T | null | undefined
type Arrayable<T> = T | Array<T>

// files
const failed = computed(() => files.value.filter(f => f.result?.state === 'fail'))
const success = computed(() => files.value.filter(f => f.result?.state === 'pass'))
const ignore = computed(() => files.value.filter(f => f.mode === 'skip' || f.mode === 'todo'))
const running = computed(() => files.value.filter(f =>
  !failed.value.includes(f)
    && !success.value.includes(f)
    && !ignore.value.includes(f),
))
const skipped = computed(() => ignore.value.filter(f => f.mode === 'skip'))
const todo = computed(() => ignore.value.filter(f => f.mode === 'todo'))
const finished = computed(() => {
  return running.value.length === 0
})
// tests
const tests = computed(() => {
  return getTests(files.value)
})
const testsFailed = computed(() => {
  return tests.value.filter(f => f.result?.state === 'fail')
})
const testsSuccess = computed(() => {
  return tests.value.filter(f => f.result?.state === 'pass')
})
const testsIgnore = computed(() => tests.value.filter(f => f.mode === 'skip' || f.mode === 'todo'))
const testsSkipped = computed(() => testsIgnore.value.filter(f => f.mode === 'skip'))
const testsTodo = computed(() => testsIgnore.value.filter(f => f.mode === 'todo'))
const totalTests = computed(() => {
  return testsFailed.value.length + testsSuccess.value.length
})
const time = computed(() => {
  const t = getTests(tests.value).reduce((acc, t) => {
    if (t.result?.duration)
      acc += t.result.duration

    return acc
  }, 0)

  if (t > 1000)
    return `${(t / 1000).toFixed(2)}s`

  return `${Math.round(t)}ms`
})

function toArray<T>(array?: Nullable<Arrayable<T>>): Array<T> {
  array = array || []
  if (Array.isArray(array))
    return array
  return [array]
}
function getTests(suite: Arrayable<Task>): Test[] {
  return toArray(suite).flatMap(s => s.type === 'test' ? [s] : s.tasks.flatMap(c => c.type === 'test' ? [c] : getTests(c)))
}
</script>

<template>
  <div v-if="isConnected" h-full flex="~ col" items-center justify-center gap-y-1 p-y-2 border="t base">
    <ProgressBar :total="files.length" :failed="failed.length" :pass="success.length" :in-progress="!finished">
      Test Files <span text-red5>{{ failed.length }} failed</span> | <span text-green5>{{ success.length }} passed</span> | <span text-yellow5>{{ running.length }} running</span> <span c-gray op-75>({{ files.length }})</span>
    </ProgressBar>
    <ProgressBar :total="totalTests" :failed="testsFailed.length" :pass="testsSuccess.length" :in-progress="!finished">
      Tests <span text-red5>{{ testsFailed.length }} failed</span> | <span text-green5>{{ testsSuccess.length }} passed</span> | <span text-yellow5>{{ testsSkipped.length }} skipped</span> | <span c-gray op-75>{{ testsTodo.length }} todo</span> <span c-gray op-75>({{ tests.length }})</span>
    </ProgressBar>
    <div text-center text-xs>
      Time: {{ time }}
    </div>
  </div>
</template>
