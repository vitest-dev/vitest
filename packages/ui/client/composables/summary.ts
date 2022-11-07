import { hasFailedSnapshot } from '@vitest/ws-client'
import type { Benchmark, Task, Test, TypeCheck } from 'vitest/src'
import { files, testRunState } from '~/composables/client'

type Nullable<T> = T | null | undefined
type Arrayable<T> = T | Array<T>

// files
export const filesFailed = computed(() => files.value.filter(f => f.result?.state === 'fail'))
export const filesSuccess = computed(() => files.value.filter(f => f.result?.state === 'pass'))
export const filesIgnore = computed(() => files.value.filter(f => f.mode === 'skip' || f.mode === 'todo'))
export const filesRunning = computed(() => files.value.filter(f =>
  !filesFailed.value.includes(f)
    && !filesSuccess.value.includes(f)
    && !filesIgnore.value.includes(f),
))
export const filesSkipped = computed(() => filesIgnore.value.filter(f => f.mode === 'skip'))
export const filesSnapshotFailed = computed(() => files.value.filter(hasFailedSnapshot))
export const filesTodo = computed(() => filesIgnore.value.filter(f => f.mode === 'todo'))
export const finished = computed(() => testRunState.value === 'idle')
// tests
export const tests = computed(() => {
  return getTests(files.value)
})
export const testsFailed = computed(() => {
  return tests.value.filter(f => f.result?.state === 'fail')
})
export const testsSuccess = computed(() => {
  return tests.value.filter(f => f.result?.state === 'pass')
})
export const testsIgnore = computed(() => tests.value.filter(f => f.mode === 'skip' || f.mode === 'todo'))
export const testsSkipped = computed(() => testsIgnore.value.filter(f => f.mode === 'skip'))
export const testsTodo = computed(() => testsIgnore.value.filter(f => f.mode === 'todo'))
export const totalTests = computed(() => testsFailed.value.length + testsSuccess.value.length)
export const time = computed(() => {
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
function isAtomTest(s: Task): s is Test | Benchmark | TypeCheck {
  return (s.type === 'test' || s.type === 'benchmark' || s.type === 'typecheck')
}
function getTests(suite: Arrayable<Task>): (Test | Benchmark | TypeCheck)[] {
  return toArray(suite).flatMap(s => isAtomTest(s) ? [s] : s.tasks.flatMap(c => isAtomTest(c) ? [c] : getTests(c)))
}
