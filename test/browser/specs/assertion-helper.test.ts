import path from 'node:path'
import { expect, test } from 'vitest'
import { buildTestProjectTree } from '../../test-utils'
import { instances, runBrowserTests } from './utils'

test('vi.defineHelper hides internal stack traces', async () => {
  const { results, ctx } = await runBrowserTests({
    root: './fixtures/assertion-helper',
  })

  const projectTree = buildTestProjectTree(results, (testCase) => {
    const result = testCase.result()
    return result.errors.map((e) => {
      const stacks = e.stacks.map(s => ({
        ...s,
        file: path.relative(ctx.config.root, s.file),
      }))
      return ({ message: e.message, stacks })
    })
  })
  expect(Object.keys(projectTree).sort()).toEqual(instances.map(i => i.browser).sort())

  for (const [name, tree] of Object.entries(projectTree)) {
    if (name === 'firefox') {
      expect.soft(tree).toMatchInlineSnapshot(`
        {
          "basic.test.ts": {
            "async": [
              {
                "message": "expected 'async' to deeply equal 'x'",
                "stacks": [
                  {
                    "column": 8,
                    "file": "basic.test.ts",
                    "line": 26,
                    "method": "",
                  },
                ],
              },
            ],
            "soft": [
              {
                "message": "expected 'soft' to deeply equal 'x'",
                "stacks": [
                  {
                    "column": 14,
                    "file": "basic.test.ts",
                    "line": 30,
                    "method": "",
                  },
                ],
              },
            ],
            "soft async": [
              {
                "message": "expected 'soft async' to deeply equal 'x'",
                "stacks": [
                  {
                    "column": 8,
                    "file": "basic.test.ts",
                    "line": 34,
                    "method": "",
                  },
                ],
              },
            ],
            "sync": [
              {
                "message": "expected 'sync' to deeply equal 'x'",
                "stacks": [
                  {
                    "column": 10,
                    "file": "basic.test.ts",
                    "line": 22,
                    "method": "",
                  },
                ],
              },
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
              {
                "message": "expected 'async' to deeply equal 'x'",
                "stacks": [
                  {
                    "column": 20,
                    "file": "basic.test.ts",
                    "line": 9,
                    "method": "",
                  },
                ],
              },
            ],
            "soft": [
              {
                "message": "expected 'soft' to deeply equal 'x'",
                "stacks": [
                  {
                    "column": 14,
                    "file": "basic.test.ts",
                    "line": 30,
                    "method": "",
                  },
                ],
              },
            ],
            "soft async": [
              {
                "message": "expected 'soft async' to deeply equal 'x'",
                "stacks": [
                  {
                    "column": 25,
                    "file": "basic.test.ts",
                    "line": 18,
                    "method": "",
                  },
                ],
              },
            ],
            "sync": [
              {
                "message": "expected 'sync' to deeply equal 'x'",
                "stacks": [
                  {
                    "column": 10,
                    "file": "basic.test.ts",
                    "line": 22,
                    "method": "",
                  },
                ],
              },
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
              {
                "message": "expected 'async' to deeply equal 'x'",
                "stacks": [
                  {
                    "column": 2,
                    "file": "basic.test.ts",
                    "line": 26,
                    "method": "",
                  },
                ],
              },
            ],
            "soft": [
              {
                "message": "expected 'soft' to deeply equal 'x'",
                "stacks": [
                  {
                    "column": 2,
                    "file": "basic.test.ts",
                    "line": 30,
                    "method": "",
                  },
                ],
              },
            ],
            "soft async": [
              {
                "message": "expected 'soft async' to deeply equal 'x'",
                "stacks": [
                  {
                    "column": 2,
                    "file": "basic.test.ts",
                    "line": 34,
                    "method": "",
                  },
                ],
              },
            ],
            "sync": [
              {
                "message": "expected 'sync' to deeply equal 'x'",
                "stacks": [
                  {
                    "column": 2,
                    "file": "basic.test.ts",
                    "line": 22,
                    "method": "",
                  },
                ],
              },
            ],
          },
        }
      `)
    }
  }
})
