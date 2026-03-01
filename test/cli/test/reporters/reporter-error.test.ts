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
    expect(result.stderr).toContain('reporter error: onTestRunStart')
    expect(result.errorTree()).toMatchInlineSnapshot(`{}`)
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
    expect(result.stderr).toContain('reporter error: onTestRunStart')
    expect(result.errorTree()).toMatchInlineSnapshot(`{}`)
    expect(onTestRunEndCalled).toBe(false)
    expect(result.exitCode).toBe(1)
  })

  test('onTestModuleQueued in normal run', async () => {
    let didThrow = false
    let onTestRunEndCalled = false
    const result = await runVitest({
      root,
      reporters: [
        {
          onTestModuleQueued() {
            didThrow = true
            throw new Error('reporter error: onTestModuleQueued')
          },
          onTestRunEnd() {
            onTestRunEndCalled = true
          },
        },
      ],
    })
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "__unhandled_errors__": [
          "reporter error: onTestModuleQueued",
        ],
        "basic.test.ts": {
          "basic": "passed",
        },
      }
    `)
    expect(didThrow).toBe(true)
    expect(onTestRunEndCalled).toBe(true)
    expect(result.exitCode).toBe(1)
  })

  // TODO: align unhandled errors
  test('onTestModuleQueued in --merge-reports', async () => {
    await runVitest({
      root,
      reporters: ['blob'],
    })

    let didThrow = false
    let onTestRunEndCalled = false
    const result = await runVitest({
      root,
      mergeReports: reportsDir,
      reporters: [
        {
          onTestModuleQueued() {
            didThrow = true
            throw new Error('reporter error: onTestModuleQueued')
          },
          onTestRunEnd() {
            onTestRunEndCalled = true
          },
        },
      ],
    })
    expect(result.stderr).toContain('reporter error: onTestModuleQueued')
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "basic": "passed",
        },
      }
    `)
    expect(didThrow).toBe(true)
    expect(onTestRunEndCalled).toBe(false)
    expect(result.exitCode).toBe(1)
  })

  // TODO: don't silence onTestModuleCollected errors
  test('onTestModuleCollected in normal run', async () => {
    let didThrow = false
    let onTestRunEndCalled = false
    const result = await runVitest({
      root,
      reporters: [
        {
          onTestModuleCollected() {
            didThrow = true
            throw new Error('reporter error: onTestModuleCollected')
          },
          onTestRunEnd() {
            onTestRunEndCalled = true
          },
        },
      ],
    })
    expect(result.stderr).toMatchInlineSnapshot(`""`)
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "basic": "passed",
        },
      }
    `)
    expect(didThrow).toBe(true)
    expect(onTestRunEndCalled).toBe(true)
    expect(result.exitCode).toBe(0)
  })

  test('onTestModuleCollected in --merge-reports', async () => {
    await runVitest({
      root,
      reporters: ['blob'],
    })

    let didThrow = false
    let onTestRunEndCalled = false
    const result = await runVitest({
      root,
      mergeReports: reportsDir,
      reporters: [
        {
          onTestModuleCollected() {
            didThrow = true
            throw new Error('reporter error: onTestModuleCollected')
          },
          onTestRunEnd() {
            onTestRunEndCalled = true
          },
        },
      ],
    })
    expect(result.stderr).toMatchInlineSnapshot(`""`)
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "basic": "passed",
        },
      }
    `)
    expect(didThrow).toBe(true)
    expect(onTestRunEndCalled).toBe(true)
    expect(result.exitCode).toBe(0)
  })

  test('onTaskUpdate in normal run', async () => {
    let didThrow = false
    let onTestRunEndCalled = false
    const result = await runVitest({
      root,
      reporters: [
        {
          onTaskUpdate() {
            didThrow = true
            throw new Error('reporter error: onTaskUpdate')
          },
          onTestRunEnd() {
            onTestRunEndCalled = true
          },
        },
      ],
    })
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "__unhandled_errors__": [
          "reporter error: onTaskUpdate",
        ],
        "basic.test.ts": {
          "basic": "passed",
        },
      }
    `)
    expect({ didThrow, onTestRunEndCalled }).toMatchInlineSnapshot(`
      {
        "didThrow": true,
        "onTestRunEndCalled": true,
      }
    `)
    expect(result.exitCode).toBe(1)
  })

  // TODO: align unhandled errors with normal run
  test('onTaskUpdate in --merge-reports', async () => {
    await runVitest({
      root,
      reporters: ['blob'],
    })

    let didThrow = false
    let onTestRunEndCalled = false
    const result = await runVitest({
      root,
      mergeReports: reportsDir,
      reporters: [
        {
          onTaskUpdate() {
            didThrow = true
            throw new Error('reporter error: onTaskUpdate')
          },
          onTestRunEnd() {
            onTestRunEndCalled = true
          },
        },
      ],
    })
    expect(result.stderr).toContain('reporter error: onTaskUpdate')
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "basic": "passed",
        },
      }
    `)
    expect({ didThrow, onTestRunEndCalled }).toMatchInlineSnapshot(`
      {
        "didThrow": true,
        "onTestRunEndCalled": false,
      }
    `)
    expect(result.exitCode).toBe(1)
  })

  // TODO: don't silence onUserConsoleLog errors
  test('onUserConsoleLog in normal run', async () => {
    let didThrow = false
    let onTestRunEndCalled = false
    const result = await runVitest({
      root,
      reporters: [
        {
          onUserConsoleLog(log) {
            if (log.content.includes('trigger-reporter-error')) {
              didThrow = true
              throw new Error('reporter error: onUserConsoleLog')
            }
          },
          onTestRunEnd() {
            onTestRunEndCalled = true
          },
        },
      ],
    })
    expect(result.stderr).toMatchInlineSnapshot(`""`)
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "basic": "passed",
        },
      }
    `)
    expect(didThrow).toBe(true)
    expect(onTestRunEndCalled).toBe(true)
    expect(result.exitCode).toBe(0)
  })

  test('onUserConsoleLog in --merge-reports', async () => {
    await runVitest({
      root,
      reporters: ['blob'],
    })

    let didThrow = false
    let onTestRunEndCalled = false
    const result = await runVitest({
      root,
      mergeReports: reportsDir,
      reporters: [
        {
          onUserConsoleLog(log) {
            if (log.content.includes('trigger-reporter-error')) {
              didThrow = true
              throw new Error('reporter error: onUserConsoleLog')
            }
          },
          onTestRunEnd() {
            onTestRunEndCalled = true
          },
        },
      ],
    })
    expect(result.stderr).toMatchInlineSnapshot(`""`)
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "basic": "passed",
        },
      }
    `)
    expect(didThrow).toBe(true)
    expect(onTestRunEndCalled).toBe(true)
    expect(result.exitCode).toBe(0)
  })
})
