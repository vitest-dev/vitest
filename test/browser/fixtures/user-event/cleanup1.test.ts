import { expect, onTestFinished, test } from 'vitest'
import { userEvent } from '@vitest/browser/context'

test('cleanup1', async () => {
  let logs: any[] = [];
  function handler(e: KeyboardEvent) {
    logs.push([e.key, e.altKey]);
  };
  document.addEventListener('keydown', handler)
  onTestFinished(() => {
    document.removeEventListener('keydown', handler);
  })

  await userEvent.keyboard('{Tab}')
  // keep alt being pressed, which should be reset
  // before running cleanup2.test.ts
  await userEvent.keyboard("{Alt>}")
  expect(logs).toMatchInlineSnapshot(`
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
  `)
})
