import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('vi.defineHelper hides internal stack traces', async () => {
  const { errorTree } = await runBrowserTests({
    root: './fixtures/assertion-helper',
  })

  const projectTree = errorTree({ project: true, stackTrace: true })
  expect(Object.keys(projectTree).sort()).toEqual(instances.map(i => i.browser).sort())

  for (const [name, tree] of Object.entries(projectTree)) {
    if (name === 'firefox') {
      expect.soft(tree).toMatchInlineSnapshot(`
        {
          "basic.test.ts": {
            "async": [
              "expected 'async' to deeply equal 'x'
            at basic.test.ts:26:8",
            ],
            "soft": [
              "expected 'soft' to deeply equal 'x'
            at basic.test.ts:30:14",
            ],
            "soft async": [
              "expected 'soft async' to deeply equal 'x'
            at basic.test.ts:34:8",
            ],
            "sync": [
              "expected 'sync' to deeply equal 'x'
            at basic.test.ts:22:10",
            ],
          },
        }
      `)
    }
    else if (name === 'webkit') {
      // async stack trace is incomplete on webkit
      // waiting for https://github.com/WebKit/WebKit/pull/57832 to land on playwright
      // bun has already landed https://github.com/oven-sh/bun/pull/22517
      expect.soft(tree).toMatchInlineSnapshot(`
        {
          "basic.test.ts": {
            "async": [
              "expected 'async' to deeply equal 'x'
            at basic.test.ts:9:20",
            ],
            "soft": [
              "expected 'soft' to deeply equal 'x'
            at basic.test.ts:30:14",
            ],
            "soft async": [
              "expected 'soft async' to deeply equal 'x'
            at basic.test.ts:18:25",
            ],
            "sync": [
              "expected 'sync' to deeply equal 'x'
            at basic.test.ts:22:10",
            ],
          },
        }
      `)
    }
    else {
      expect.soft(tree).toMatchInlineSnapshot(`
        {
          "basic.test.ts": {
            "async": [
              "expected 'async' to deeply equal 'x'
            at basic.test.ts:26:2",
            ],
            "soft": [
              "expected 'soft' to deeply equal 'x'
            at basic.test.ts:30:2",
            ],
            "soft async": [
              "expected 'soft async' to deeply equal 'x'
            at basic.test.ts:34:2",
            ],
            "sync": [
              "expected 'sync' to deeply equal 'x'
            at basic.test.ts:22:2",
            ],
          },
        }
      `)
    }
  }
})
