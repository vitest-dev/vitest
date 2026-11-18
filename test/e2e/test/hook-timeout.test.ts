import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('timeout error with stack trace', async () => {
  const { stderr } = await runVitest({
    root: './fixtures/hook-timeout',
  })
  expect(stderr).toMatchSnapshot()
})

test('timeout error stack starts with the timeout message', async () => {
  const { ctx } = await runVitest({
    root: './fixtures/hook-timeout',
  })
  const errors = ctx!.state
    .getFiles()
    .flatMap((f) => f.tasks.flatMap((t) => t.result?.errors ?? []))
  expect(errors.map((e) => e.stack?.split('\n')[0])).toMatchInlineSnapshot(`
    [
      "HookTimeoutError: Hook timed out in 10ms.",
      "HookTimeoutError: Hook timed out in 30ms.",
      "HookTimeoutError: Hook timed out in 50ms.",
      "TestTimeoutError: Test timed out in 123ms.",
    ]
  `)
})
