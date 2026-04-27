import type { RunnerTestFile } from 'vitest'
import type { TestCase, TestCollection, TestModule, TestProject, Vitest } from 'vitest/node'
import { resolve } from 'pathe'
import { it as baseTest, expect } from 'vitest'
import { runVitest } from '../../test-utils'

const root = resolve(__dirname, '..', 'fixtures', 'reported-tasks')

const it = baseTest.extend<{
  ctx: Vitest
  files: RunnerTestFile[]
  testModule: TestModule
  project: TestProject
}>({
  ctx: [
    async ({}, use) => {
      const collectedTestModules: TestModule[] = []
      const { ctx } = await runVitest({
        root,
        include: ['**/*.test.ts'],
        reporters: [
          'verbose',
          {
            onTestModuleCollected(testModule) {
              collectedTestModules.push(testModule)
            },
          },
        ],
        includeTaskLocation: true,
        logHeapUsage: true,
        experimental: { importDurations: { limit: 10 } },
      })
      expect(collectedTestModules).toHaveLength(1)
      await use(ctx!)
    },
    { scope: 'file' },
  ],
  files: [
    async ({ ctx }, use) => {
      const state = ctx!.state
      const files = state.getFiles()
      await use(files)
    },
    { scope: 'file' },
  ],
  testModule: [
    async ({ ctx, files }, use) => {
      const state = ctx!.state
      const testModule = state.getReportedEntity(files[0])! as TestModule
      await use(testModule)
    },
    { scope: 'file' },
  ],
  project: [
    async ({ ctx }, use) => {
      const project = ctx!.getRootProject()
      await use(project)
    },
    { scope: 'file' },
  ],
})

const now = new Date()

it('correctly reports a file', ({ testModule, files, project }) => {
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
  expect(testModule.children.size).toBe(18)

  const tests = [...testModule.children.tests()]
  expect(tests).toHaveLength(13)
  const deepTests = [...testModule.children.allTests()]
  expect(deepTests).toHaveLength(23)

  expect.soft([...testModule.children.allTests('skipped')]).toHaveLength(8)
  expect.soft([...testModule.children.allTests('passed')]).toHaveLength(10)
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

it('correctly reports a passed test', ({ testModule, files }) => {
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
    fails: undefined,
    retry: undefined,
    repeats: undefined,
    mode: 'run',
    tags: [],
    timeout: 5000,
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

it('correctly reports failed test', ({ testModule, files }) => {
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
    fails: undefined,
    tags: [],
    timeout: 5000,
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

it('correctly reports a skipped test', ({ testModule }) => {
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

it('correctly reports multiple failures', ({ testModule }) => {
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

it('correctly reports test assigned options', ({ testModule }) => {
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

it('correctly reports retried tests', ({ testModule }) => {
  const testRetry = findTest(testModule.children, 'retries a test')
  expect(testRetry.options.retry).toBe(5)
  expect(testRetry.options.repeats).toBeUndefined()
  expect(testRetry.result()!.state).toBe('failed')
})

it('correctly reports flaky tests', ({ testModule }) => {
  const testFlaky = findTest(testModule.children, 'retries a test with success')
  const diagnostic = testFlaky.diagnostic()!
  expect(diagnostic.flaky).toBe(true)
  expect(diagnostic.retryCount).toBe(2)
  expect(diagnostic.repeatCount).toBe(0)
  const result = testFlaky.result()!
  expect(result.state).toBe('passed')
  expect(result.errors).toHaveLength(2)
})

it('correctly reports repeated tests', ({ testModule }) => {
  const testRepeated = findTest(testModule.children, 'repeats a test')
  const diagnostic = testRepeated.diagnostic()!
  expect(diagnostic.flaky).toBe(false)
  expect(diagnostic.retryCount).toBe(0)
  expect(diagnostic.repeatCount).toBe(5)
  const result = testRepeated.result()!
  expect(result.state).toBe('failed')
  expect(result.errors).toHaveLength(6)
})

it('correctly passed down metadata', ({ testModule }) => {
  const testMetadata = findTest(testModule.children, 'registers a metadata')
  const meta = testMetadata.meta()
  expect(meta).toHaveProperty('key', 'value')
})

it('correctly builds the full name', ({ testModule }) => {
  const suiteTopLevel = testModule.children.suites().next().value!
  const suiteSecondLevel = suiteTopLevel.children.suites().next().value!
  const test = suiteSecondLevel.children.at(0) as TestCase
  expect(test.fullName).toBe('a group > a nested group > runs a test in a nested group')
  expect(suiteTopLevel.fullName).toBe('a group')
  expect(suiteSecondLevel.fullName).toBe('a group > a nested group')
})

it('correctly reports import durations', ({ testModule }) => {
  const diagnostic = testModule.diagnostic()

  const filePath = resolve(root, './1_first.test.ts')
  const importDuration = diagnostic.importDurations[filePath]
  expect(importDuration.selfTime).toBeGreaterThan(0)
  expect(importDuration.totalTime).toBeGreaterThan(0)
})

it('can create new test specifications', ({ testModule }) => {
  const moduleSpec = testModule.toTestSpecification()
  expect(moduleSpec.moduleId).toBe(testModule.moduleId)
  expect(moduleSpec.testIds).toBeUndefined()
  expect(moduleSpec.project).toBe(testModule.project)

  const testSuite = [...testModule.children.suites()][0]
  const suiteSpec = testSuite.toTestSpecification()
  expect(suiteSpec.moduleId).toBe(testModule.moduleId)
  expect(suiteSpec.testIds).toEqual([
    '-1008553841_11_0',
    '-1008553841_11_1',
    '-1008553841_11_2_0',
    '-1008553841_11_2_1',
    '-1008553841_11_2_2',
    '-1008553841_11_2_3',
  ])
  expect(suiteSpec.project).toBe(testModule.project)

  const testCase = testSuite.children.at(0) as TestCase
  const caseSpec = testCase.toTestSpecification()
  expect(caseSpec.moduleId).toBe(testModule.moduleId)
  expect(caseSpec.testIds).toEqual(['-1008553841_11_0'])
  expect(caseSpec.project).toBe(testModule.project)
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
