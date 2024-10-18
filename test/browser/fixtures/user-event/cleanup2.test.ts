import { expect, onTestFinished, test } from 'vitest'
import { userEvent } from '@vitest/browser/context'

// test per-test-file cleanup just in case

test('cleanup2', async () => {
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
