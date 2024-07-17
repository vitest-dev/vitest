import { beforeAll, expect, it } from 'vitest'
import { resolve } from 'pathe'
import type { File } from 'vitest'
import type { StateManager } from 'vitest/src/node/state.js'
import type { WorkspaceProject } from 'vitest/node'
import { runVitest } from '../../test-utils'
import type { TestFile } from '../../../packages/vitest/src/node/reporters/reported-tasks'

const now = new Date()
// const finishedFiles: File[] = []
const collectedFiles: File[] = []
let state: StateManager
let project: WorkspaceProject
let files: File[]
let testFile: TestFile

beforeAll(async () => {
  const { ctx } = await runVitest({
    root: resolve(__dirname, '..', 'fixtures', 'reported-tasks'),
    include: ['**/*.test.ts'],
    reporters: [
      'verbose',
      {
        // onFinished(files) {
        //   finishedFiles.push(...files || [])
        // },
        onCollected(files) {
          collectedFiles.push(...files || [])
        },
      },
    ],
    includeTaskLocation: true,
    logHeapUsage: true,
  })
  state = ctx!.state
  project = ctx!.getCoreWorkspaceProject()
  files = state.getFiles()
  expect(files).toHaveLength(1)
  testFile = state._experimental_getReportedEntity(files[0])! as TestFile
  expect(testFile).toBeDefined()
})

it('correctly reports a file', () => {
  // suite properties not available on file
  expect(testFile).not.toHaveProperty('parent')
  expect(testFile).not.toHaveProperty('options')
  expect(testFile).not.toHaveProperty('file')
  expect(testFile).not.toHaveProperty('fullName')
  expect(testFile).not.toHaveProperty('name')

  expect(testFile.type).toBe('file')
  expect(testFile.task).toBe(files[0])
  expect(testFile.id).toBe(files[0].id)
  expect(testFile.location).toBeUndefined()
  expect(testFile.moduleId).toBe(resolve('./fixtures/reported-tasks/1_first.test.ts'))
  expect(testFile.project).toBe(project)
  expect(testFile.children.size).toBe(14)

  const tests = [...testFile.children.tests()]
  expect(tests).toHaveLength(11)
  const deepTests = [...testFile.children.deepTests()]
  expect(deepTests).toHaveLength(19)

  const suites = [...testFile.children.suites()]
  expect(suites).toHaveLength(3)
  const deepSuites = [...testFile.children.deepSuites()]
  expect(deepSuites).toHaveLength(4)

  const diagnostic = testFile.diagnostic()
  expect(diagnostic).toBeDefined()
  expect(diagnostic.environmentSetupDuration).toBeGreaterThan(0)
  expect(diagnostic.prepareDuration).toBeGreaterThan(0)
  expect(diagnostic.collectDuration).toBeGreaterThan(0)
  expect(diagnostic.duration).toBeGreaterThan(0)
  // doesn't have a setup file
  expect(diagnostic.setupDuration).toBe(0)
})

it('correctly reports a passed test', () => {
  const passedTest = testFile.children.find('test', 'runs a test')!
  expect(passedTest.type).toBe('test')
  expect(passedTest.task).toBe(files[0].tasks[0])
  expect(passedTest.name).toBe('runs a test')
  expect(passedTest.fullName).toBe('runs a test')
  expect(passedTest.file).toBe(testFile)
  expect(passedTest.parent).toBe(testFile)
  expect(passedTest.options).toEqual({
    each: undefined,
    concurrent: undefined,
    shuffle: undefined,
    retry: undefined,
    repeats: undefined,
    mode: 'run',
  })
  expect(passedTest.meta()).toEqual({})

  const result = passedTest.result()!
  expect(result).toBeDefined()
  expect(result.state).toBe('passed')
  expect(result.errors).toBeUndefined()

  const diagnostic = passedTest.diagnostic()!
  expect(diagnostic).toBeDefined()
  expect(diagnostic.heap).toBeGreaterThan(0)
  expect(diagnostic.duration).toBeGreaterThan(0)
  expect(date(new Date(diagnostic.startTime))).toBe(date(now))
  expect(diagnostic.flaky).toBe(false)
  expect(diagnostic.repeatCount).toBe(0)
  expect(diagnostic.repeatCount).toBe(0)
})

it('correctly reports failed test', () => {
  const passedTest = testFile.children.find('test', 'fails a test')!
  expect(passedTest.type).toBe('test')
  expect(passedTest.task).toBe(files[0].tasks[1])
  expect(passedTest.name).toBe('fails a test')
  expect(passedTest.fullName).toBe('fails a test')
  expect(passedTest.file).toBe(testFile)
  expect(passedTest.parent).toBe(testFile)
  expect(passedTest.options).toEqual({
    each: undefined,
    concurrent: undefined,
    shuffle: undefined,
    retry: undefined,
    repeats: undefined,
    mode: 'run',
  })
  expect(passedTest.meta()).toEqual({})

  const result = passedTest.result()!
  expect(result).toBeDefined()
  expect(result.state).toBe('failed')
  expect(result.errors).toHaveLength(1)
  expect(result.errors![0]).toMatchObject({
    diff: expect.any(String),
    message: 'expected 1 to be 2 // Object.is equality',
    ok: false,
    stack: expect.stringContaining('expected 1 to be 2 // Object.is equality'),
    stacks: [
      {
        column: 13,
        file: resolve('./fixtures/reported-tasks/1_first.test.ts'),
        line: 10,
        method: '',
      },
    ],
  })

  const diagnostic = passedTest.diagnostic()!
  expect(diagnostic).toBeDefined()
  expect(diagnostic.heap).toBeGreaterThan(0)
  expect(diagnostic.duration).toBeGreaterThan(0)
  expect(date(new Date(diagnostic.startTime))).toBe(date(now))
  expect(diagnostic.flaky).toBe(false)
  expect(diagnostic.repeatCount).toBe(0)
  expect(diagnostic.repeatCount).toBe(0)
})

it('correctly reports multiple failures', () => {
  const testCase = testFile.children.find('test', 'fails multiple times')!
  const result = testCase.result()!
  expect(result).toBeDefined()
  expect(result.state).toBe('failed')
  expect(result.errors).toHaveLength(2)
  expect(result.errors![0]).toMatchObject({
    message: 'expected 1 to be 2 // Object.is equality',
  })
  expect(result.errors![1]).toMatchObject({
    message: 'expected 2 to be 3 // Object.is equality',
  })
})

it('correctly reports test assigned options', () => {
  const testOptionSkip = testFile.children.find('test', 'skips an option test')!
  expect(testOptionSkip.options.mode).toBe('skip')
  const testModifierSkip = testFile.children.find('test', 'skips a .modifier test')!
  expect(testModifierSkip.options.mode).toBe('skip')

  const testOptionTodo = testFile.children.find('test', 'todos an option test')!
  expect(testOptionTodo.options.mode).toBe('todo')
  const testModifierTodo = testFile.children.find('test', 'todos a .modifier test')!
  expect(testModifierTodo.options.mode).toBe('todo')
})

it('correctly reports retried tests', () => {
  const testRetry = testFile.children.find('test', 'retries a test')!
  expect(testRetry.options.retry).toBe(5)
  expect(testRetry.options.repeats).toBeUndefined()
  expect(testRetry.result()!.state).toBe('failed')
})

it('correctly reports flaky tests', () => {
  const testFlaky = testFile.children.find('test', 'retries a test with success')!
  const diagnostic = testFlaky.diagnostic()!
  expect(diagnostic.flaky).toBe(true)
  expect(diagnostic.retryCount).toBe(2)
  expect(diagnostic.repeatCount).toBe(0)
  const result = testFlaky.result()!
  expect(result.state).toBe('passed')
  expect(result.errors).toHaveLength(2)
})

it('correctly reports repeated tests', () => {
  const testRepeated = testFile.children.find('test', 'repeats a test')!
  const diagnostic = testRepeated.diagnostic()!
  expect(diagnostic.flaky).toBe(false)
  expect(diagnostic.retryCount).toBe(0)
  expect(diagnostic.repeatCount).toBe(5)
  const result = testRepeated.result()!
  expect(result.state).toBe('failed')
  expect(result.errors).toHaveLength(6)
})

it('correctly passed down metadata', () => {
  const testMetadata = testFile.children.find('test', 'regesters a metadata')!
  const meta = testMetadata.meta()
  expect(meta.key).toBe('value')
})

it('correctly finds test in nested suites', () => {
  const oneNestedTest = testFile.children.deepFind('test', 'runs a test in a group')!
  const oneTestedSuite = testFile.children.find('suite', 'a group')!
  expect(oneNestedTest.parent).toEqual(oneTestedSuite)

  const twoNestedTest = testFile.children.deepFind('test', 'runs a test in a nested group')!
  expect(twoNestedTest.parent).toEqual(
    oneTestedSuite.children.find('suite', 'a nested group'),
  )
})

function date(time: Date) {
  return `${time.getDate()}/${time.getMonth() + 1}/${time.getFullYear()}`
}
