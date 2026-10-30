import { expect, test } from 'vitest'
import { provider } from '../settings'
import { instances, runBrowserTests, runInlineBrowserTests } from './utils'

test('viewport', async () => {
  const { stderr, ctx } = await runBrowserTests({
    root: './fixtures/viewport',
  })

  expect(stderr).toBe('')
  expect(Object.fromEntries(ctx.state.getFiles().map((f) => [f.name, f.result.state])))
    .toMatchInlineSnapshot(`
    {
      "basic.test.ts": "pass",
    }
  `)
})

test('scrolling in a test file does not shift the next test file', async () => {
  const testFile = `
import { expect, test } from 'vitest'

test('the first row is fully visible', async () => {
  for (let i = 0; i < 100; i++) {
    const row = document.createElement('div')
    row.textContent = 'Row ' + i
    document.body.append(row)
  }
  const entry = await new Promise<IntersectionObserverEntry>((resolve) => {
    const observer = new IntersectionObserver(([entry]) => {
      observer.disconnect()
      resolve(entry)
    }, { threshold: 1 })
    observer.observe(document.body.firstElementChild!)
  })
  expect(entry.intersectionRatio).toBe(1)
  document.body.lastElementChild!.scrollIntoView()
})
`
  const result = await runInlineBrowserTests({
    'first.test.ts': testFile,
    'second.test.ts': testFile,
  })
  expect(result.stderr).toBe('')

  const tree = result.errorTree({ project: true })
  for (const { browser } of instances) {
    expect.soft(tree[browser], browser).toMatchInlineSnapshot(`
      {
        "first.test.ts": {
          "the first row is fully visible": "passed",
        },
        "second.test.ts": {
          "the first row is fully visible": "passed",
        },
      }
    `)
  }
})

test.runIf(provider.name === 'playwright')(
  'page.viewport() rejects when the provider cannot resize the page',
  async () => {
    const { errorTree } = await runInlineBrowserTests({
      'basic.test.ts': `
import { test } from 'vitest'
import { page } from 'vitest/browser'

test('fractional size', async () => {
  await page.viewport(320.5, 480)
})
`,
    })

    const trees = errorTree({ project: true, stackTrace: true })
    expect(Object.keys(trees).sort()).toEqual(instances.map(({ browser }) => browser).sort())
    for (const [browser, tree] of Object.entries(trees)) {
      expect.soft(tree, browser).toMatchInlineSnapshot(`
        {
          "basic.test.ts": {
            "fractional size": [
              "page.setViewportSize: viewportSize.width: expected integer, got float 320.5
            at basic.test.ts:6:14",
            ],
          },
        }
      `)
    }
  },
)
