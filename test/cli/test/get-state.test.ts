import type { TestUserConfig } from 'vitest/node'
import { runInlineTests } from '#test-utils'
import { expect, test } from 'vitest'

test.for([
  { isolate: true },
  { isolate: false, maxWorkers: 1 },
  { isolate: false, maxWorkers: 3 },
  { isolate: false, fileParallelism: false },
] satisfies TestUserConfig[])(`getState().testPath during collection %s`, async (config) => {
  const result = await runInlineTests(
    {
      'a.test.ts': createTest('a.test.ts'),
      'b.test.ts': createTest('b.test.ts'),
      'c.test.ts': createTest('c.test.ts'),
    },
    config,
  )
  expect(result.stderr).toBe('')
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "a.test.ts": {
        "a.test.ts": "passed",
      },
      "b.test.ts": {
        "b.test.ts": "passed",
      },
      "c.test.ts": {
        "c.test.ts": "passed",
      },
    }
  `)
})

function createTest(fileName: string) {
  return /* ts */`
    import { expect, test } from 'vitest'

    const testPath = expect.getState().testPath;

    test("${fileName}", () => {
      expect(testPath).toContain("${fileName}")
    })
`
}
