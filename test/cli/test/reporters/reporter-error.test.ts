import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { runVitest } from '#test-utils'
import { beforeEach, describe, expect, test } from 'vitest'

const root = './fixtures/reporters/reporter-error'
const reportsDir = resolve(root, '.vitest-reports')

beforeEach(() => {
  rmSync(reportsDir, { force: true, recursive: true })
})

describe('reporter errors', () => {
  test('onTestRunStart in normal run', async () => {
    let onTestRunEndCalled = false
    const result = await runVitest({
      root,
      reporters: [
        {
          onTestRunStart() {
            throw new Error('reporter error: onTestRunStart')
          },
          onTestRunEnd() {
            onTestRunEndCalled = true
          },
        },
      ],
    })
    expect(result.stderr).toContain(`reporter error: onTestRunStart`)
    expect(onTestRunEndCalled).toBe(false)
    expect(result.exitCode).toBe(1)
  })

  test('onTestRunStart in --merge-reports', async () => {
    await runVitest({
      root,
      reporters: ['blob'],
    })

    let onTestRunEndCalled = false
    const result = await runVitest({
      root,
      mergeReports: reportsDir,
      reporters: [
        {
          onTestRunStart() {
            throw new Error('reporter error: onTestRunStart')
          },
          onTestRunEnd() {
            onTestRunEndCalled = true
          },
        },
      ],
    })
    expect(result.stderr).toContain(`reporter error: onTestRunStart`)
    expect(onTestRunEndCalled).toBe(false)
    expect(result.exitCode).toBe(1)
  })

  test.skip('aligns normal run with merge reports for onTestRunStart', async () => {
    // let normalHookCalled = false
    // let normalOnTestRunEndCalled = false

    // const normalReporter: Reporter = {
    //   onTestRunStart() {
    //     normalHookCalled = true
    //     throw new Error('reporter boom: onTestRunStart')
    //   },
    //   onTestRunEnd() {
    //     normalOnTestRunEndCalled = true
    //   },
    // }

    // normal run behavior
    let onTestRunEndCalled = false
    const result = await runVitest({
      root,
      reporters: [
        {
          onTestRunStart() {
            throw new Error('reporter error: onTestRunStart')
          },
          onTestRunEnd() {
            onTestRunEndCalled = true
          },
        },
      ],
    })
    expect(result.stderr).toContain(`reporter error: onTestRunStart`)
    expect(onTestRunEndCalled).toBe(false)
    expect(result.exitCode).toBe(1)

    // const normal = {
    //   exitCode: normalExitCode,
    //   thrown: normalThrown,
    //   hookCalled: normalHookCalled,
    //   onTestRunEndCalled: normalOnTestRunEndCalled,
    //   stderrHasReporterError: /reporter boom:/.test(normalStderr),
    // }

    // generate blob
    await runVitest({
      config: false,
      root,
      reporters: [['blob', { outputFile: './.vitest-reports/blob.json' }]],
    })

    // let mergedHookCalled = false
    // let mergedOnTestRunEndCalled = false

    // const mergedReporter: Reporter = {
    //   onTestRunEnd() {
    //     mergedOnTestRunEndCalled = true
    //   },
    //   onTestRunStart() {
    //     mergedHookCalled = true
    //     throw new Error('reporter boom: onTestRunStart')
    //   },
    // }

    // const { exitCode: mergedExitCode, stderr: mergedStderr, thrown: mergedThrown } = await runVitest({
    //   config: false,
    //   root,
    //   mergeReports: reportsDir,
    //   reporters: [mergedReporter],
    // })

    // const merged = {
    //   exitCode: mergedExitCode,
    //   thrown: mergedThrown,
    //   hookCalled: mergedHookCalled,
    //   onTestRunEndCalled: mergedOnTestRunEndCalled,
    //   stderrHasReporterError: /reporter boom:/.test(mergedStderr),
    // }

    // expect(normal).toEqual(merged)
  })

  // test('aligns normal run with merge reports for onTestModuleCollected', async () => {
  //   rmSync(reportsDir, { force: true, recursive: true })

  //   let normalHookCalled = false
  //   let normalOnTestRunEndCalled = false

  //   const normalReporter: Reporter = {
  //     onTestRunEnd() {
  //       normalOnTestRunEndCalled = true
  //     },
  //     onTestModuleCollected() {
  //       normalHookCalled = true
  //       throw new Error('reporter boom: onTestModuleCollected')
  //     },
  //   }

  //   const { exitCode: normalExitCode, stderr: normalStderr, thrown: normalThrown } = await runVitest({
  //     config: false,
  //     root,
  //     reporters: [normalReporter],
  //   })

  //   const normal = {
  //     exitCode: normalExitCode,
  //     thrown: normalThrown,
  //     hookCalled: normalHookCalled,
  //     onTestRunEndCalled: normalOnTestRunEndCalled,
  //     stderrHasReporterError: /reporter boom:/.test(normalStderr),
  //   }

  //   await runVitest({
  //     config: false,
  //     root,
  //     reporters: [['blob', { outputFile: './.vitest-reports/blob.json' }]],
  //   })

  //   let mergedHookCalled = false
  //   let mergedOnTestRunEndCalled = false

  //   const mergedReporter: Reporter = {
  //     onTestRunEnd() {
  //       mergedOnTestRunEndCalled = true
  //     },
  //     onTestModuleCollected() {
  //       mergedHookCalled = true
  //       throw new Error('reporter boom: onTestModuleCollected')
  //     },
  //   }

  //   const { exitCode: mergedExitCode, stderr: mergedStderr, thrown: mergedThrown } = await runVitest({
  //     config: false,
  //     root,
  //     mergeReports: reportsDir,
  //     reporters: [mergedReporter],
  //   })

  //   const merged = {
  //     exitCode: mergedExitCode,
  //     thrown: mergedThrown,
  //     hookCalled: mergedHookCalled,
  //     onTestRunEndCalled: mergedOnTestRunEndCalled,
  //     stderrHasReporterError: /reporter boom:/.test(mergedStderr),
  //   }

  //   expect(normal).toEqual(merged)
  // })

  // test('aligns normal run with merge reports for onUserConsoleLog', async () => {
  //   rmSync(reportsDir, { force: true, recursive: true })

  //   let normalHookCalled = false
  //   let normalOnTestRunEndCalled = false

  //   const normalReporter: Reporter = {
  //     onTestRunEnd() {
  //       normalOnTestRunEndCalled = true
  //     },
  //     onUserConsoleLog() {
  //       normalHookCalled = true
  //       throw new Error('reporter boom: onUserConsoleLog')
  //     },
  //   }

  //   const { exitCode: normalExitCode, stderr: normalStderr, thrown: normalThrown } = await runVitest({
  //     config: false,
  //     root,
  //     reporters: [normalReporter],
  //   })

  //   const normal = {
  //     exitCode: normalExitCode,
  //     thrown: normalThrown,
  //     hookCalled: normalHookCalled,
  //     onTestRunEndCalled: normalOnTestRunEndCalled,
  //     stderrHasReporterError: /reporter boom:/.test(normalStderr),
  //   }

  //   await runVitest({
  //     config: false,
  //     root,
  //     reporters: [['blob', { outputFile: './.vitest-reports/blob.json' }]],
  //   })

  //   let mergedHookCalled = false
  //   let mergedOnTestRunEndCalled = false

  //   const mergedReporter: Reporter = {
  //     onTestRunEnd() {
  //       mergedOnTestRunEndCalled = true
  //     },
  //     onUserConsoleLog() {
  //       mergedHookCalled = true
  //       throw new Error('reporter boom: onUserConsoleLog')
  //     },
  //   }

  //   const { exitCode: mergedExitCode, stderr: mergedStderr, thrown: mergedThrown } = await runVitest({
  //     config: false,
  //     root,
  //     mergeReports: reportsDir,
  //     reporters: [mergedReporter],
  //   })

  //   const merged = {
  //     exitCode: mergedExitCode,
  //     thrown: mergedThrown,
  //     hookCalled: mergedHookCalled,
  //     onTestRunEndCalled: mergedOnTestRunEndCalled,
  //     stderrHasReporterError: /reporter boom:/.test(mergedStderr),
  //   }

  //   expect(normal).toEqual(merged)
  // })
})
