import { expect, onTestFinished, test } from 'vitest'
import { userEvent } from '@vitest/browser/context'

test('cleanup retry', { retry: 1 }, async (ctx) => {
  let logs: any[] = [];
  function handler(e: KeyboardEvent) {
    logs.push([e.key, e.altKey]);
  };
  document.addEventListener('keydown', handler)
  onTestFinished(() => {
    document.removeEventListener('keydown', handler);
  })

  await userEvent.keyboard('{Tab}')
  await userEvent.keyboard("{Alt>}")
  if (ctx.task.result.retryCount === 0) {
    throw new Error("test retry")
  }
  expect(logs).toEqual(
    [
      [
        "Tab",
        false,
      ],
      [
        "Alt",
        true,
      ],
    ]
  )
})
