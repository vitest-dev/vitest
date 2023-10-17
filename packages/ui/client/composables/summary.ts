import { hasFailedSnapshot } from '@vitest/ws-client'
import type { Custom, Task, Test } from 'vitest/src'
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
  const t = files.value.reduce((acc, t) => {
    acc += Math.max(0, t.collectDuration || 0)
    acc += Math.max(0, t.setupDuration || 0)
    acc += Math.max(0, t.result?.duration || 0)
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

function isAtomTest(s: Task): s is Test | Custom {
  return (s.type === 'test' || s.type === 'custom')
}

function getTests(suite: Arrayable<Task>): (Test | Custom)[] {
  const tests: (Test | Custom)[] = []
  const arraySuites = toArray(suite)
  for (const s of arraySuites) {
    if (isAtomTest(s)) {
      tests.push(s)
    }
    else {
      for (const task of s.tasks) {
        if (isAtomTest(task))
          tests.push(task)
        else
          tests.push(...getTests(task))
      }
    }
  }
  return tests
}
