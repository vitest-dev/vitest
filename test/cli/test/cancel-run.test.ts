import type { TestModule } from 'vitest/node'
import { Readable, Writable } from 'node:stream'
import { stripVTControlCharacters } from 'node:util'
import { createDefer } from '@vitest/utils/helpers'
import { expect, onTestFinished, test, vi } from 'vitest'
import { createVitest, registerConsoleShortcuts } from 'vitest/node'

const CTRL_C = '\x03'

test('can force cancel a run via CLI', { timeout: 5_000 }, async () => {
  const onExit = vi.fn<never>()
  const exit = process.exit
  onTestFinished(() => {
    process.exit = exit
  })
  process.exit = onExit

  const onTestModuleStart = createDefer<void>()
  const vitest = await createVitest('test', {
    root: 'fixtures/cancel-run',
    include: ['blocked-thread.test.ts'],
    reporters: [{ onTestModuleStart: () => onTestModuleStart.resolve() }],
  })
  onTestFinished(() => vitest.close())

  const stdin = new Readable({ read: () => '' }) as NodeJS.ReadStream
  stdin.isTTY = true
  stdin.setRawMode = () => stdin
  registerConsoleShortcuts(vitest, stdin, new Writable())

  const onLog = vi.spyOn(vitest.logger, 'log').mockImplementation(() => {})
  const promise = vitest.start()

  await onTestModuleStart

  // First CTRL+c should log warning about graceful exit
  stdin.emit('data', CTRL_C)

  // Let the test case start running
  await new Promise(resolve => setTimeout(resolve, 100))

  const logs = onLog.mock.calls.map(log => stripVTControlCharacters(log[0] || '').trim())
  expect(logs).toContain('Cancelling test run. Press CTRL+c again to exit forcefully.')

  // Second CTRL+c should stop run
  stdin.emit('data', CTRL_C)
  await promise

  expect(onExit).toHaveBeenCalled()
})

test('cancelling test run stops test execution immediately', async () => {
  const onTestRunEnd = createDefer<readonly TestModule[]>()
  const onTestCaseReady = createDefer<void>()

  const vitest = await createVitest('test', {
    root: 'fixtures/cancel-run',
    include: ['blocked-test-cases.test.ts'],
    reporters: [{
      onTestCaseAnnotate: (_, annotation) => {
        if (annotation.message === 'Running long test, do the cancelling now!') {
          onTestCaseReady.resolve()
        }
      },
      onTestRunEnd(testModules) {
        onTestRunEnd.resolve(testModules)
      },
    }],
  })
  onTestFinished(() => vitest.close())

  const promise = vitest.start()

  await onTestCaseReady
  await vitest.cancelCurrentRun('keyboard-input')

  const testModules = await onTestRunEnd
  await Promise.all([vitest.close(), promise])

  expect(testModules).toHaveLength(1)

  const tests = Array.from(testModules[0].children.allTests().map(test => ({
    name: test.name,
    status: test.result().state,
    note: (test.result() as any).note,
    afterEachRun: (test.meta() as any).afterEachDone === true,
  })))

  expect(tests).toMatchInlineSnapshot(`
    [
      {
        "afterEachRun": true,
        "name": "one",
        "note": undefined,
        "status": "passed",
      },
      {
        "afterEachRun": true,
        "name": "two",
        "note": undefined,
        "status": "passed",
      },
      {
        "afterEachRun": true,
        "name": "this test starts and gets cancelled, its after each should be called",
        "note": "The test run was aborted by the user.",
        "status": "skipped",
      },
      {
        "afterEachRun": false,
        "name": "third, no after each expected",
        "note": "The test run was aborted by the user.",
        "status": "skipped",
      },
      {
        "afterEachRun": false,
        "name": "fourth, no after each expected",
        "note": "The test run was aborted by the user.",
        "status": "skipped",
      },
      {
        "afterEachRun": false,
        "name": "fifth, no after each expected",
        "note": "The test run was aborted by the user.",
        "status": "skipped",
      },
    ]
  `)
})
