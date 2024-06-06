import type { Custom, Task, Test } from '@vitest/runner'
import { hasFailedSnapshot } from '@vitest/ws-client'
import { findById, testRunState } from '~/composables/client'
import type { UIFile } from '~/composables/client/types'

const timeout = 100

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
  start: () => void
  end: () => void
  restart: () => void
}

export const files = shallowRef<UIFile[]>([])
export const finished = computed(() => testRunState.value === 'idle')

interface InternalTestState extends TestStatus {
  _timeout: ReturnType<typeof setInterval>
  _collect: () => void
}

export const testStatus = reactive<TestStatus>(<InternalTestState>{
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
  time: '0ms',
  _timeout: 0 as any,
  _collect() {
    const now = performance.now()
    const useFiles = files.value.map(file => findById(file.id)!)
    const data = {
      files: useFiles.length,
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
    for (const f of useFiles) {
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
      if (hasFailedSnapshot([f]))
        data.filesSnapshotFailed++

      for (const t of getTests(f)) {
        if (t.result?.state === 'fail') {
          data.testsFailed++
        }
        else if (t.result?.state === 'pass') {
          data.testsSuccess++
        }
        else if (t.result?.state === 'skip') {
          data.testsFailed++
          data.testsIgnore++
        }
        else if (t.result?.state === 'todo') {
          data.testsTodo++
          data.testsIgnore++
        }
        data.totalTests = data.testsFailed + data.testsSuccess
      }
      console.log(`collect took: ${performance.now() - now}ms`)
    }
    requestAnimationFrame(() => {
      testStatus.files = data.files
      testStatus.time = data.timeString
      testStatus.filesFailed = data.filesFailed
      testStatus.filesSuccess = data.filesSuccess
      testStatus.filesIgnore = data.filesIgnore
      testStatus.filesRunning = data.filesRunning
      testStatus.filesSkipped = data.filesSkipped
      testStatus.filesTodo = data.filesTodo
      testStatus.filesSnapshotFailed = data.filesSnapshotFailed
      testStatus.testsFailed = data.testsFailed
      testStatus.testsSuccess = data.testsSuccess
      testStatus.testsFailed = data.testsFailed
      testStatus.testsTodo = data.testsTodo
      testStatus.testsIgnore = data.testsIgnore
      testStatus.totalTests = data.totalTests
    })
    /* files.value.forEach((file) => {
      if (file.state) {
        this.testsFailed += file.state.failed
        this.testsSuccess += file.result.success
        this.testsIgnore += file.result.ignore
        this.testsSkipped += file.result.skipped
        this.testsTodo += file.result.todo
        this.totalTests += file.result.total
        switch (file.result.state) {
          case 'failed':
            this.filesFailed++
            break
          case 'success':
            this.filesSuccess++
            break
          case 'ignore':
            this.filesIgnore++
            break
          case 'running':
            this.filesRunning++
            break
          case 'skipped':
            this.filesSkipped++
            break
          case 'snapshotFailed':
            this.filesSnapshotFailed++
            break
          case 'todo':
            this.filesTodo++
            break
        }
      }
    }) */
  },
  start() {
    this.files = 0
    this.filesFailed = 0
    this.filesSuccess = 0
    this.filesIgnore = 0
    this.filesRunning = 0
    this.filesSkipped = 0
    this.filesSnapshotFailed = 0
    this.filesTodo = 0
    this.testsFailed = 0
    this.testsSuccess = 0
    this.testsIgnore = 0
    this.testsSkipped = 0
    this.testsTodo = 0
    this.totalTests = 0
    this.time = ''
    clearInterval(this._timeout)
    this._timeout = setInterval(this._collect, timeout)
  },
  restart() {
    clearInterval(this._timeout)
    this._timeout = setInterval(this._collect, timeout)
  },
  end() {
    clearInterval(this._timeout)
    this._collect()
  },
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
