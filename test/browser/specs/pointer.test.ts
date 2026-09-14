import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'
import { instances, provider } from '../settings'

test('pointer API works with UI enabled', async () => {
  const { errorTree } = await runInlineTests({
    'pointer.test.ts': await readFile(
      resolve(
        import.meta.dirname,
        '..',
        'fixtures/user-event/pointer.test.ts',
      ),
      { encoding: 'utf8' },
    ),
  }, {
    browser: {
      enabled: true,
      headless: true,
      ui: true,
      provider,
      instances,
    },
    // might be flaky because of 1:MANY pixel scaling mapping
    retry: 3,
  })

  expect(errorTree({ project: true })).toMatchInlineSnapshot(`
    {
      "chromium": {
        "pointer.test.ts": {
          "click at coordinates triggers hover events": "passed",
          "click triggers hover events": "passed",
          "clicks with middle button": "passed",
          "clicks with right button": "passed",
          "down only fires mousedown event": "passed",
          "drags and drops": "passed",
          "keeps using previous target or coordinates": {
            "coords resets previous target": "passed",
            "previous coordinates different action": "passed",
            "previous coordinates same action": "passed",
            "previous target different action": "passed",
            "previous target same action": "passed",
            "target resets previous coords": "passed",
          },
          "keyboard-fired modifiers apply to pointer events": "passed",
          "modifiers work with coordinates": "passed",
          "moves between coordinates": "passed",
          "multiple clicks trigger double click": "passed",
          "persistent modifiers survive multiple actions": "passed",
          "pointer click action works with offsets": "passed",
          "pointer down action works with offsets": "passed",
          "pointer up action works with offsets": "passed",
          "temporary modifiers apply to one action": "passed",
        },
      },
      "firefox": {
        "pointer.test.ts": {
          "click at coordinates triggers hover events": "passed",
          "click triggers hover events": "passed",
          "clicks with middle button": "passed",
          "clicks with right button": "passed",
          "down only fires mousedown event": "passed",
          "drags and drops": "passed",
          "keeps using previous target or coordinates": {
            "coords resets previous target": "passed",
            "previous coordinates different action": "passed",
            "previous coordinates same action": "passed",
            "previous target different action": "passed",
            "previous target same action": "passed",
            "target resets previous coords": "passed",
          },
          "keyboard-fired modifiers apply to pointer events": "passed",
          "modifiers work with coordinates": "passed",
          "moves between coordinates": "passed",
          "multiple clicks trigger double click": "passed",
          "persistent modifiers survive multiple actions": "passed",
          "pointer click action works with offsets": "passed",
          "pointer down action works with offsets": "passed",
          "pointer up action works with offsets": "passed",
          "temporary modifiers apply to one action": "passed",
        },
      },
      "webkit": {
        "pointer.test.ts": {
          "click at coordinates triggers hover events": "passed",
          "click triggers hover events": "passed",
          "clicks with middle button": "passed",
          "clicks with right button": "passed",
          "down only fires mousedown event": "passed",
          "drags and drops": "passed",
          "keeps using previous target or coordinates": {
            "coords resets previous target": "passed",
            "previous coordinates different action": "passed",
            "previous coordinates same action": "passed",
            "previous target different action": "passed",
            "previous target same action": "passed",
            "target resets previous coords": "passed",
          },
          "keyboard-fired modifiers apply to pointer events": "passed",
          "modifiers work with coordinates": "passed",
          "moves between coordinates": "passed",
          "multiple clicks trigger double click": "passed",
          "persistent modifiers survive multiple actions": "passed",
          "pointer click action works with offsets": "passed",
          "pointer down action works with offsets": "passed",
          "pointer up action works with offsets": "passed",
          "temporary modifiers apply to one action": "passed",
        },
      },
    }
  `)
})
