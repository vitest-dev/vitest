import type { TestBenchmark } from 'vitest'
import type { JsonTestResult, JsonTestResults, Vitest } from 'vitest/node'
import { readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { beforeAll, describe, expect, test } from 'vitest'
import { buildTestTree } from '../../test-utils'
import { instances, runBrowserTests } from './utils'

function noop() {}

describe('running browser tests', async () => {
  let stderr: string
  let stdout: string
  let browserResultJson: JsonTestResults
  let passedTests: JsonTestResult[]
  let failedTests: JsonTestResult[]
  let vitest: Vitest
  const events: string[] = []
  const emittedBenchmarks: Array<{ projectName: string; testName: string; benchmark: TestBenchmark }> = []

  beforeAll(async () => {
    ({
      stderr,
      stdout,
      ctx: vitest,
    } = await runBrowserTests({
      allowOnly: true,
      reporters: [
        {
          onBrowserInit(project) {
            events.push(`onBrowserInit ${project.name}`)
          },
          onTestCaseBenchmark(testCase, benchmark) {
            emittedBenchmarks.push({
              projectName: testCase.project.name || '',
              testName: testCase.fullName,
              benchmark,
            })
          },
        },
        'json',
        {
          onInit: noop,
          onTestRunStart: noop,
          onTestModuleCollected: noop,
          onTestRunEnd: noop,
          onTestRemoved: noop,
          onWatcherStart: noop,
          onWatcherRerun: noop,
          onServerRestart: noop,
          onUserConsoleLog: noop,
        },
        'default',
      ],
    }))

    const browserResult = await readFile('./browser.json', 'utf-8')
    browserResultJson = JSON.parse(browserResult) as JsonTestResults
    const getPassed = (results: JsonTestResult[]) => results.filter(result => result.status === 'passed' && !result.message)
    const getFailed = (results: JsonTestResult[]) => results.filter(result => result.status === 'failed')
    passedTests = getPassed(browserResultJson.testResults)
    failedTests = getFailed(browserResultJson.testResults)
  })

  test('tests are actually running', () => {
    expect(stderr).toBe('')

    const testFiles = browserResultJson.testResults.map(t => t.name)

    vitest.projects.forEach((project) => {
      // the order is non-deterministic
      expect(events).toContain(`onBrowserInit ${project.name}`)
    })

    // test files are optimized automatically (type-check-only files are excluded)
    const runtimeTestFiles = testFiles.filter(f => !f.endsWith('.test-d.ts'))
    expect(vitest.projects.map(p => p.browser?.vite.config.optimizeDeps.entries))
      .toEqual(vitest.projects.map(() => expect.arrayContaining(runtimeTestFiles)))

    const testFilesCount = readdirSync('./test')
      .filter(n => n.includes('.test.') || n.includes('.test-d.') || n.includes('.bench.'))
      .length + 1 // 1 is in-source-test

    expect(browserResultJson.testResults).toHaveLength(testFilesCount * instances.length)
    expect(passedTests).toHaveLength(browserResultJson.testResults.length)
    expect(failedTests).toHaveLength(0)
  })

  test('benchmarks run in a dedicated `(bench)` project per browser instance', () => {
    const benchProjects = vitest.projects.filter(p => p.name.endsWith('(bench)'))
    expect(benchProjects.map(p => p.name).sort()).toEqual(
      instances.map(({ browser }) => `${browser} (bench)`).sort(),
    )
  })

  test('perProject benchmarks emit tasks with the perProject flag in every browser', () => {
    const records = emittedBenchmarks.filter(e =>
      e.testName === 'perProject registrations flow through the browser RPC (onTestBenchmark)',
    )
    // the test calls `.run()` twice, so each browser produces 2 benchmark records
    expect(records.length, `perProject emitted: ${records.length}`).toBe(2 * instances.length)
    for (const record of records) {
      expect(record.benchmark.tasks, `empty tasks for ${record.projectName}`).toHaveLength(1)
      const [task] = record.benchmark.tasks
      expect(task.perProject, `missing perProject flag on ${record.projectName}/${task.name}`).toBe(true)
      expect(task.fromStore).toBeUndefined()
    }
  })

  test('bench.compare emits one benchmark with both registrations ranked', () => {
    const records = emittedBenchmarks.filter(e =>
      e.testName === 'bench.compare resolves a BenchStorage in the browser',
    )
    expect(records.length).toBe(instances.length)
    for (const record of records) {
      expect(record.benchmark.tasks.map(t => t.name).sort(), `unexpected tasks for ${record.projectName}`).toEqual(['a', 'b'])
      expect(record.benchmark.tasks.map(t => t.rank).sort()).toEqual([1, 2])
    }
  })

  test('writeResult flows through the write-artifact RPC in every browser', () => {
    const records = emittedBenchmarks.filter(e =>
      e.testName === 'writeResult exercises the writeBenchmarkResult RPC round-trip',
    )
    expect(records.length).toBe(instances.length)
    for (const record of records) {
      expect(record.benchmark.tasks, `empty tasks for ${record.projectName}`).toHaveLength(1)
      const [task] = record.benchmark.tasks
      expect(task.name).toBe('with-write')
    }
  })

  test('tags are collected', () => {
    expect(vitest.config.tags).toEqual([
      { name: 'e2e', priority: 10 },
      { name: 'test', priority: 5 },
      { name: 'browser', priority: 1 },
    ])

    const testModule = vitest.state.getTestModules().find(m => m.moduleId.includes('tags.test.ts'))
    expect.assert(testModule)
    expect(buildTestTree([testModule], t => t.tags)).toMatchInlineSnapshot(`
      {
        "test/tags.test.ts": {
          "suite 1": {
            "suite 2": {
              "test 2": [
                "browser",
                "e2e",
              ],
            },
            "test 1": [
              "browser",
              "test",
            ],
          },
        },
      }
    `)
  })

  test('runs in-source tests', () => {
    expect(stdout).toContain('src/actions.ts')
    const actionsTest = passedTests.find(t => t.name.includes('/actions.ts'))
    expect.assert(actionsTest)
    expect(actionsTest.assertionResults).toHaveLength(1)
  })

  test('unsubscribes cancel listeners after run', async () => {
    // should not throw birpc closing errors
    await expect(vitest.cancelCurrentRun('keyboard-input')).resolves.not.toThrow()
  })
})
