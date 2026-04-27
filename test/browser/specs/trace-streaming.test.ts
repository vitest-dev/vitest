import type { BrowserServerState } from '../../../packages/browser/src/node/state'
import { expect, onTestFinished, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'
import { runBrowserTests } from './utils'

function getStreamedTraceEntriesSize(ctx: NonNullable<Awaited<ReturnType<typeof runBrowserTests>>['ctx']>) {
  let total = 0
  for (const project of ctx.projects) {
    if (project.browser) {
      total += (project.browser.state as BrowserServerState).streamedTraceEntries.size
    }
  }
  return total
}

test('server-side buffer is cleared after test run completes', async () => {
  const { ctx } = await runBrowserTests({
    root: './fixtures/trace-streaming',
  })

  // All entries streamed during the run must have been consumed by _recordBrowserTrace.
  // A non-zero size indicates a finalization call was missed, which would cause entries
  // to accumulate indefinitely in watch mode.
  expect(getStreamedTraceEntriesSize(ctx!)).toBe(0)
})

test('server-side buffer stays empty across watch mode re-runs', async () => {
  const { vitest, ctx } = await runVitest({
    root: 'fixtures/trace-streaming',
    watch: true,
    reporters: 'none',
  })
  onTestFinished(() => ctx?.close())

  await vitest.waitForStdout('Waiting for file changes...')

  expect(
    getStreamedTraceEntriesSize(ctx!),
    'buffer should be empty after first run',
  ).toBe(0)

  vitest.resetOutput()
  editFile('./fixtures/trace-streaming/basic.test.ts', content => `${content}\n`)

  await vitest.waitForStdout('Waiting for file changes...')

  expect(
    getStreamedTraceEntriesSize(ctx!),
    'buffer should be empty after second run (no accumulation across reruns)',
  ).toBe(0)
})
