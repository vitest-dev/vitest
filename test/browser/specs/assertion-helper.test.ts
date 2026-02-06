import path from 'node:path'
import { expect, test } from 'vitest'
import { buildTestTree } from '../../test-utils'
import { runBrowserTests } from './utils'

test('vi.helper hides internal stack traces', async () => {
  const { results, ctx } = await runBrowserTests({
    root: './fixtures/assertion-helper',
  })

  for (const testModule of results) {
    const tree = buildTestTree([testModule], (testCase) => {
      const result = testCase.result()
      return result.errors.map((e) => {
        const stacks = e.stacks.map(s => ({
          ...s,
          file: path.relative(ctx.config.root, s.file),
        }))
        return ({ message: e.message, stacks })
      })
    })

    // TODO: branch by provider/browser
    switch (testModule.project.name) {
      case 'firefox': {
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
                      "line": 29,
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
                      "line": 33,
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
                      "line": 37,
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
                      "line": 25,
                      "method": "",
                    },
                  ],
                },
              ],
            },
          }
        `)
        break
      }
      default: {
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
                      "line": 29,
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
                      "line": 33,
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
                      "line": 37,
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
                      "line": 25,
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
  }
})
