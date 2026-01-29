import { Readable, Writable } from 'node:stream'
import { stripVTControlCharacters } from 'node:util'
import { createDefer } from '@vitest/utils/helpers'
import { expect, onTestFinished, test, vi } from 'vitest'
import { createVitest, registerConsoleShortcuts } from 'vitest/node'

test('can force cancel a run', async () => {
  const onExit = vi.fn<never>()
  const exit = process.exit
  onTestFinished(() => {
    process.exit = exit
  })
  process.exit = onExit

  const onTestCaseReady = createDefer<void>()
  const vitest = await createVitest('test', {
    root: 'fixtures/cancel-run',
    reporters: [{ onTestCaseReady: () => onTestCaseReady.resolve() }],
  })
  onTestFinished(() => vitest.close())

  const stdin = new Readable({ read: () => '' }) as NodeJS.ReadStream
  stdin.isTTY = true
  stdin.setRawMode = () => stdin
  registerConsoleShortcuts(vitest, stdin, new Writable())

  const onLog = vi.spyOn(vitest.logger, 'log').mockImplementation(() => {})
  const promise = vitest.start()

  await onTestCaseReady

  // First CTRL+c should log warning about graceful exit
  stdin.emit('data', '\x03')

  const logs = onLog.mock.calls.map(log => stripVTControlCharacters(log[0] || '').trim())
  expect(logs).toContain('Cancelling test run. Press CTRL+c again to exit forcefully.')

  // Second CTRL+c should stop run
  stdin.emit('data', '\x03')
  await promise

  expect(onExit).toHaveBeenCalled()
})
