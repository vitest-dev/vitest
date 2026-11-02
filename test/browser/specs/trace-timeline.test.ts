import type { TestFsStructure } from '../../test-utils'
import { expect, test } from 'vitest'
import { extractTimelines } from '../../test-utils'
import { instances, runInlineBrowserTests } from './utils'

async function runBrowserTests(structure: TestFsStructure) {
  return runInlineBrowserTests(structure, {
    reporters: 'default',
    browser: {
      ui: false,
      instances: instances.slice(0, 1),
      screenshotFailures: false,
    },
  })
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
    step                       locator              start    duration  location
    load                       -                    +<time>  <time>    basic.test.ts:12
    ├── click                  getByRole('button')  +<time>  <time>    basic.test.ts:13
    └── toHaveTextContent      getByRole('button')  +<time>  <time>    basic.test.ts:14
    after wait                 -                    +<time>  -         basic.test.ts:17
    toHaveTextContent [ERROR]  getByRole('button')  +<time>  <time>    basic.test.ts:18",
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
    step   locator              start    duration  location
    click  getByRole('button')  +<time>  <time>    basic.test.ts:7",
    ]
  `)
})

test('prints only the last steps of a long trace', async () => {
  const { stderr } = await runBrowserTests({
    'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'
      import { page } from 'vitest/browser'

      test('fail', async () => {
        await page.mark('group', async () => {
          for (let i = 1; i <= 4; i++) {
            await page.mark('inner ' + i)
          }
        })
        for (let i = 1; i <= 7; i++) {
          await page.mark('outer ' + i)
        }
        expect(1).toBe(2)
      })
    `,
  })

  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace:
    step                 start    duration  location
    ... 2 earlier steps
    ├── inner 2          +<time>  -         basic.test.ts:8
    ├── inner 3          +<time>  -         basic.test.ts:8
    └── inner 4          +<time>  -         basic.test.ts:8
    outer 1              +<time>  -         basic.test.ts:12
    outer 2              +<time>  -         basic.test.ts:12
    outer 3              +<time>  -         basic.test.ts:12
    outer 4              +<time>  -         basic.test.ts:12
    outer 5              +<time>  -         basic.test.ts:12
    outer 6              +<time>  -         basic.test.ts:12
    outer 7              +<time>  -         basic.test.ts:12",
    ]
  `)
})

test('prints trace timeline of each attempt', async () => {
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

  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace:
    step   locator              start    duration  location
    click  getByRole('button')  +<time>  <time>    basic.test.ts:7",
      "Trace (retry 1):
    step   locator              start    duration  location
    click  getByRole('button')  +<time>  <time>    basic.test.ts:7",
    ]
  `)
})
