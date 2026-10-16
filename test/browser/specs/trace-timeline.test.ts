import type { TestFsStructure } from '../../test-utils'
import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

async function runBrowserTests(structure: TestFsStructure) {
  return runInlineBrowserTests(structure, {
    reporters: 'default',
    browser: {
      ui: false,
      instances: instances.slice(0, 1),
      traceView: true,
      screenshotFailures: false,
    },
  })
}

function extractTimelines(stderr: string) {
  return [...stderr.matchAll(/\nTrace\b.*?\n\n/gs)].map((match) =>
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
        await page.mark('load', async () => {
          await page.getByRole('button').click()
          await expect.element(page.getByRole('button')).toHaveTextContent('Load')
        })
        await new Promise(resolve => setTimeout(resolve, 300))
        await page.mark('after wait')
        await expect.element(page.getByRole('button'), { timeout: 100 }).toHaveTextContent('Done')
      })
    `,
  })

  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace:
     step locator start duration location
     load - +<time> <time> basic.test.ts:12
     ├── click getByRole('button') +<time> <time> basic.test.ts:13
     └── toHaveTextContent getByRole('button') +<time> <time> basic.test.ts:14
     after wait - +<time> - basic.test.ts:17
     toHaveTextContent [ERROR] getByRole('button') +<time> <time> basic.test.ts:18",
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
      "Trace:
     step locator start duration location
     click getByRole('button') +<time> <time> basic.test.ts:7",
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
      "Trace (retry 1):
     step locator start duration location
     click getByRole('button') +<time> <time> basic.test.ts:7",
      "Trace (retry 1):
     step locator start duration location
     click getByRole('button') +<time> <time> basic.test.ts:7",
    ]
  `)
})
