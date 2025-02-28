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

// test per-test cleanup
test('cleanup1.2', async () => {
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
