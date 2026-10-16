import type { TestFsStructure } from '../../test-utils'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

async function runBrowserTests(structure: TestFsStructure, traceView = true) {
  return runInlineTests({
    ...structure,
    'vitest.config.js': `
      import { instances, provider } from '../settings.ts'

      export default {
        test: {
          browser: {
            enabled: true,
            provider,
            ui: false,
            headless: true,
            instances: instances.slice(0, 1),
            traceView: ${traceView},
            screenshotFailures: false,
          },
        },
      }`,
  })
}

function extractTimelines(stderr: string) {
  return [...stderr.matchAll(/\nTrace \(.*?\n\n/gs)].map((match) =>
    match[0]
      .trim()
      .replace(/\d+(\.\d+)?m?s\b/g, '<time>')
      .replace(/ +/g, ' ')
      // columns can differ between browsers
      .replace(/(\.test\.ts:\d+):\d+/g, '$1'),
  )
}

test('prints trace timeline on failure', async () => {
  const { stderr } = await runBrowserTests({
    'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'
      import { page } from 'vitest/browser'

      test('pass', async () => {
        document.body.innerHTML = '<button>Load</button>'
        await page.getByRole('button').click()
      })

      test('fail', async () => {
        document.body.innerHTML = '<button>Load</button>'
        await page.getByRole('button').click()
        await expect.element(page.getByRole('button')).toHaveTextContent('Load')
        await new Promise(resolve => setTimeout(resolve, 300))
        await page.mark('after wait')
        await expect.element(page.getByRole('button'), { timeout: 100 }).toHaveTextContent('Done')
      })
    `,
  })

  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace (<time>):
     start duration step locator location
     <time> <time> click getByRole('button') basic.test.ts:12
     <time> <time> toHaveTextContent getByRole('button') basic.test.ts:13
     <time> after wait basic.test.ts:15
     <time> <time> toHaveTextContent [ERROR] getByRole('button') basic.test.ts:16",
    ]
  `)
})

test('prints trace timeline for a failure outside trace steps', async () => {
  const { stderr } = await runBrowserTests({
    'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'
      import { page } from 'vitest/browser'

      test('fail', async () => {
        document.body.innerHTML = '<button>Load</button>'
        await page.getByRole('button').click()
        expect(1).toBe(2)
      })
    `,
  })

  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace (<time>):
     start duration step locator location
     <time> <time> click getByRole('button') basic.test.ts:7",
    ]
  `)
})

test('prints trace timeline of the last retry', async () => {
  const { stderr } = await runBrowserTests({
    'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'
      import { page } from 'vitest/browser'

      test('fail', { retry: 1 }, async () => {
        document.body.innerHTML = '<button>Load</button>'
        await page.getByRole('button').click()
        expect(1).toBe(2)
      })
    `,
  })

  // TODO: each attempt's error should print its own attempt's trace instead of the last one
  // https://github.com/vitest-dev/vitest/issues/11614
  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace (<time>, retry 1):
     start duration step locator location
     <time> <time> click getByRole('button') basic.test.ts:7",
      "Trace (<time>, retry 1):
     start duration step locator location
     <time> <time> click getByRole('button') basic.test.ts:7",
    ]
  `)
})

test('does not print trace timeline without trace view', async () => {
  const { stderr, errorTree } = await runBrowserTests(
    {
      'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      test('fail', () => {
        expect(1).toBe(2)
      })
    `,
    },
    false,
  )

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "fail": [
          "expected 1 to be 2 // Object.is equality",
        ],
      },
    }
  `)
  expect(extractTimelines(stderr)).toEqual([])
})

test('does not print trace timeline without recorded steps', async () => {
  const { stderr } = await runBrowserTests({
    'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      test('fail', () => {
        expect(1).toBe(2)
      })
    `,
  })

  expect(stderr).toMatch('expected 1 to be 2')
  expect(extractTimelines(stderr)).toEqual([])
})
