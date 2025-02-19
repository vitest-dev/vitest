import type { RunnerTestFile } from 'vitest'
import type { WorkspaceProject } from 'vitest/node'
import type { StateManager } from 'vitest/src/node/state.js'
import type { TestCase, TestCollection, TestModule } from '../../../packages/vitest/src/node/reporters/reported-tasks'
import { resolve } from 'pathe'
import { beforeAll, expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

const now = new Date()
// const finishedFiles: File[] = []
const collectedFiles: RunnerTestFile[] = []
let state: StateManager
let project: WorkspaceProject
let files: RunnerTestFile[]
let testModule: TestModule

const root = resolve(__dirname, '..', 'fixtures', 'reported-tasks')

beforeAll(async () => {
  const { ctx } = await runVitest({
    root,
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
  project = ctx!.getRootProject()
  files = state.getFiles()
  expect(files).toHaveLength(1)
  testModule = state.getReportedEntity(files[0])! as TestModule
  expect(testModule).toBeDefined()
})

it('correctly reports a file', () => {
  // suite properties not available on file
  expect(testModule).not.toHaveProperty('parent')
  expect(testModule).not.toHaveProperty('options')
  expect(testModule).not.toHaveProperty('module')
  expect(testModule).not.toHaveProperty('fullName')
  expect(testModule).not.toHaveProperty('name')

  expect(testModule.type).toBe('module')
  expect(testModule.task).toBe(files[0])
  expect(testModule.id).toBe(files[0].id)
  expect(testModule.location).toBeUndefined()
  expect(testModule.moduleId).toBe(resolve(root, './1_first.test.ts'))
  expect(testModule.project).toBe(project)
  expect(testModule.children.size).toBe(17)

  const tests = [...testModule.children.tests()]
  expect(tests).toHaveLength(12)
  const deepTests = [...testModule.children.allTests()]
  expect(deepTests).toHaveLength(22)

  expect.soft([...testModule.children.allTests('skipped')]).toHaveLength(8)
  expect.soft([...testModule.children.allTests('passed')]).toHaveLength(9)
  expect.soft([...testModule.children.allTests('failed')]).toHaveLength(5)
  expect.soft([...testModule.children.allTests('pending')]).toHaveLength(0)

  const suites = [...testModule.children.suites()]
  expect(suites).toHaveLength(5)
  const deepSuites = [...testModule.children.allSuites()]
  expect(deepSuites).toHaveLength(6)

  const diagnostic = testModule.diagnostic()
  expect(diagnostic).toBeDefined()
  expect(diagnostic.environmentSetupDuration).toBeGreaterThan(0)
  expect(diagnostic.prepareDuration).toBeGreaterThan(0)
  expect(diagnostic.collectDuration).toBeGreaterThan(0)
  expect(diagnostic.duration).toBeGreaterThan(0)
  // doesn't have a setup file
  expect(diagnostic.setupDuration).toBe(0)
})

it('correctly reports a passed test', () => {
  const passedTest = findTest(testModule.children, 'runs a test')
  expect(passedTest.type).toBe('test')
  expect(passedTest.task).toBe(files[0].tasks[0])
  expect(passedTest.name).toBe('runs a test')
  expect(passedTest.fullName).toBe('runs a test')
  expect(passedTest.module).toBe(testModule)
  expect(passedTest.parent).toBe(testModule)
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
  const passedTest = findTest(testModule.children, 'fails a test')
  expect(passedTest.type).toBe('test')
  expect(passedTest.task).toBe(files[0].tasks[1])
  expect(passedTest.name).toBe('fails a test')
  expect(passedTest.fullName).toBe('fails a test')
  expect(passedTest.module).toBe(testModule)
  expect(passedTest.parent).toBe(testModule)
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
        file: resolve(root, './1_first.test.ts'),
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

it('correctly reports a skipped test', () => {
  const optionTestCase = findTest(testModule.children, 'skips an option test')
  expect(optionTestCase.result()).toEqual({
    state: 'skipped',
    note: undefined,
    errors: undefined,
  })

  const modifierTestCase = findTest(testModule.children, 'skips a .modifier test')
  expect(modifierTestCase.result()).toEqual({
    state: 'skipped',
    note: undefined,
    errors: undefined,
  })

  const ctxSkippedTestCase = findTest(testModule.children, 'skips an ctx.skip() test')
  expect(ctxSkippedTestCase.result()).toEqual({
    state: 'skipped',
    note: undefined,
    errors: undefined,
  })

  const testOptionTodo = findTest(testModule.children, 'todos an option test')
  expect(testOptionTodo.result()).toEqual({
    state: 'skipped',
    note: undefined,
    errors: undefined,
  })

  const testModifierTodo = findTest(testModule.children, 'todos a .modifier test')
  expect(testModifierTodo.result()).toEqual({
    state: 'skipped',
    note: undefined,
    errors: undefined,
  })
})

it('correctly reports multiple failures', () => {
  const testCase = findTest(testModule.children, 'fails multiple times')
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
  const testOptionSkip = findTest(testModule.children, 'skips an option test')
  expect(testOptionSkip.options.mode).toBe('skip')
  const testModifierSkip = findTest(testModule.children, 'skips a .modifier test')
  expect(testModifierSkip.options.mode).toBe('skip')

  const testOptionTodo = findTest(testModule.children, 'todos an option test')
  expect(testOptionTodo.options.mode).toBe('todo')
  const testModifierTodo = findTest(testModule.children, 'todos a .modifier test')
  expect(testModifierTodo.options.mode).toBe('todo')

  const testInsideTodoDescribe = findTest(testModule.children, 'test inside todo group')
  expect(testInsideTodoDescribe.options.mode).toBe('todo')

  const testInsideSkippedDescribe = findTest(testModule.children, 'test inside skipped group')
  expect(testInsideSkippedDescribe.options.mode).toBe('skip')
})

it('correctly reports retried tests', () => {
  const testRetry = findTest(testModule.children, 'retries a test')
  expect(testRetry.options.retry).toBe(5)
  expect(testRetry.options.repeats).toBeUndefined()
  expect(testRetry.result()!.state).toBe('failed')
})

it('correctly reports flaky tests', () => {
  const testFlaky = findTest(testModule.children, 'retries a test with success')
  const diagnostic = testFlaky.diagnostic()!
  expect(diagnostic.flaky).toBe(true)
  expect(diagnostic.retryCount).toBe(2)
  expect(diagnostic.repeatCount).toBe(0)
  const result = testFlaky.result()!
  expect(result.state).toBe('passed')
  expect(result.errors).toHaveLength(2)
})

it('correctly reports repeated tests', () => {
  const testRepeated = findTest(testModule.children, 'repeats a test')
  const diagnostic = testRepeated.diagnostic()!
  expect(diagnostic.flaky).toBe(false)
  expect(diagnostic.retryCount).toBe(0)
  expect(diagnostic.repeatCount).toBe(5)
  const result = testRepeated.result()!
  expect(result.state).toBe('failed')
  expect(result.errors).toHaveLength(6)
})

it('correctly passed down metadata', () => {
  const testMetadata = findTest(testModule.children, 'registers a metadata')
  const meta = testMetadata.meta()
  expect(meta).toHaveProperty('key', 'value')
})

it('correctly builds the full name', () => {
  const suiteTopLevel = testModule.children.suites().next().value!
  const suiteSecondLevel = suiteTopLevel.children.suites().next().value!
  const test = suiteSecondLevel.children.at(0) as TestCase
  expect(test.fullName).toBe('a group > a nested group > runs a test in a nested group')
  expect(suiteTopLevel.fullName).toBe('a group')
  expect(suiteSecondLevel.fullName).toBe('a group > a nested group')
})

function date(time: Date) {
  return `${time.getDate()}/${time.getMonth() + 1}/${time.getFullYear()}`
}

function deepFind(children: TestCollection, name: string): TestCase | undefined {
  for (const task of children) {
    if (task.type === 'test') {
      if (task.name === name) {
        return task
      }
    }
    if (task.type === 'suite') {
      const result = deepFind(task.children, name)
      if (result) {
        return result
      }
    }
  }
}

function findTest(children: TestCollection, name: string): TestCase {
  const testCase = deepFind(children, name)
  if (!testCase) {
    throw new Error(`Test "${name}" not found`)
  }
  return testCase
}
