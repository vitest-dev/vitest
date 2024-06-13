import { hasFailedSnapshot } from '@vitest/ws-client'
import type { Custom, Task, Test } from 'vitest'
import { client, findById } from '~/composables/client'
import { uiFiles } from '~/composables/explorer/tree'

type Nullable<T> = T | null | undefined
type Arrayable<T> = T | Array<T>

interface TestStatus {
  files: number
  filesFailed: number
  filesSuccess: number
  filesIgnore: number
  filesRunning: number
  filesSkipped: number
  filesSnapshotFailed: number
  filesTodo: number
  testsFailed: number
  testsSuccess: number
  testsIgnore: number
  testsSkipped: number
  testsTodo: number
  totalTests: number
  time: string
  failedSnapshot: boolean
  failedSnapshotEnabled: boolean
}

export const testStatus = reactive(<TestStatus>{
  files: 0,
  filesFailed: 0,
  filesSuccess: 0,
  filesIgnore: 0,
  filesRunning: 0,
  filesSkipped: 0,
  filesSnapshotFailed: 0,
  filesTodo: 0,
  testsFailed: 0,
  testsSuccess: 0,
  testsIgnore: 0,
  testsSkipped: 0,
  testsTodo: 0,
  totalTests: 0,
  failedSnapshot: false,
  failedSnapshotEnabled: false,
})

const { pause, resume } = useRafFn(collect, { fpsLimit: 10, immediate: false })

function collect() {
  const now = performance.now()
  const idMap = client.state.idMap
  const filesMap = new Map(uiFiles.value.filter(f => idMap.has(f.id)).map(f => [f.id, f]))
  const useFiles = Array.from(filesMap.values()).map(file => [file.id, findById(file.id)] as const)
  const data = {
    files: filesMap.size,
    timeString: '',
    filesFailed: 0,
    filesSuccess: 0,
    filesIgnore: 0,
    filesRunning: 0,
    filesSkipped: 0,
    filesTodo: 0,
    filesSnapshotFailed: 0,
    testsFailed: 0,
    testsSuccess: 0,
    testsIgnore: 0,
    testsSkipped: 0,
    testsTodo: 0,
    totalTests: 0,
  }
  let time = 0
  for (const [id, f] of useFiles) {
    if (!f)
      continue
    const file = filesMap.get(id)
    if (file) {
      file.mode = f.mode
      file.setupDuration = f.setupDuration
      file.prepareDuration = f.prepareDuration
      file.environmentLoad = f.environmentLoad
      file.collectDuration = f.collectDuration
      file.duration = f.result?.duration
      file.state = f.result?.state
    }
    time += Math.max(0, f.collectDuration || 0)
    time += Math.max(0, f.setupDuration || 0)
    time += Math.max(0, f.result?.duration || 0)
    time += Math.max(0, f.environmentLoad || 0)
    time += Math.max(0, f.prepareDuration || 0)
    data.timeString = time > 1000 ? `${(time / 1000).toFixed(2)}s` : `${Math.round(time)}ms`
    if (f.result?.state === 'fail') {
      data.filesFailed++
    }
    else if (f.result?.state === 'pass') {
      data.filesSuccess++
    }
    else if (f.mode === 'skip') {
      data.filesIgnore++
      data.filesSkipped++
    }
    else if (f.mode === 'todo') {
      data.filesIgnore++
      data.filesTodo++
    }
    else {
      data.filesRunning++
    }

    const tests = getTests(f)

    data.totalTests += tests.length

    for (const t of tests) {
      if (t.result?.state === 'fail') {
        data.testsFailed++
      }
      else if (t.result?.state === 'pass') {
        data.testsSuccess++
      }
      else if (t.mode === 'skip') {
        data.testsIgnore++
        data.testsSkipped++
      }
      else if (t.mode === 'todo') {
        data.testsIgnore++
        data.testsTodo++
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(`collect took: ${performance.now() - now}ms`)
  testStatus.files = data.files
  testStatus.time = data.timeString
  testStatus.filesFailed = data.filesFailed
  testStatus.filesSuccess = data.filesSuccess
  testStatus.filesIgnore = data.filesIgnore
  testStatus.filesRunning = data.filesRunning
  testStatus.filesSkipped = data.filesSkipped
  testStatus.filesTodo = data.filesTodo
  testStatus.testsFailed = data.testsFailed
  testStatus.testsSuccess = data.testsSuccess
  testStatus.testsFailed = data.testsFailed
  testStatus.testsTodo = data.testsTodo
  testStatus.testsIgnore = data.testsIgnore
  testStatus.testsSkipped = data.testsSkipped
  testStatus.totalTests = data.totalTests
}

export function endRun() {
  pause()
  collect()
  testStatus.failedSnapshot = uiFiles.value && hasFailedSnapshot(uiFiles.value.map(f => findById(f.id)!))
  testStatus.failedSnapshotEnabled = true
}

export function resumeRun() {
  resume()
}

export function startRun() {
  testStatus.files = 0
  testStatus.filesFailed = 0
  testStatus.filesSuccess = 0
  testStatus.filesIgnore = 0
  testStatus.filesRunning = 0
  testStatus.filesSkipped = 0
  testStatus.filesSnapshotFailed = 0
  testStatus.filesTodo = 0
  testStatus.testsFailed = 0
  testStatus.testsSuccess = 0
  testStatus.testsIgnore = 0
  testStatus.testsSkipped = 0
  testStatus.testsTodo = 0
  testStatus.totalTests = 0
  testStatus.failedSnapshotEnabled = false
  collect()
}

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
        if (isAtomTest(task)) {
          tests.push(task)
        }
        else {
          const taskTests = getTests(task)
          for (const test of taskTests) tests.push(test)
        }
      }
    }
  }
  return tests
}
