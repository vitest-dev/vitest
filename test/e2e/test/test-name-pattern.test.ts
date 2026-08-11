import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

// `testNamePattern` matches against the task's `fullTestName`, i.e. the suite
// chain and the test name joined with ` > ` (the same string shown in reporters).
// Before Vitest 4 the segments were joined with a single space, mirroring Jest.
const files = {
  'a.test.js': `
    import { describe, test } from 'vitest'
    describe('group', () => {
      test('matches', () => {})
    })
    test('group matches', () => {})
  `,
}

test('testNamePattern matches the " > "-joined full name', async () => {
  const { buildTree, stderr } = await runInlineTests(files, {
    testNamePattern: 'group > matches',
  })

  expect(stderr).toBe('')
  expect(buildTree(t => t.result().state)).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "group": {
          "matches": "passed",
        },
        "group matches": "skipped",
      },
    }
  `)
})

test('testNamePattern no longer matches the space-joined chain across suites', async () => {
  const { buildTree, stderr } = await runInlineTests(files, {
    testNamePattern: 'group matches',
  })

  expect(stderr).toBe('')
  expect(buildTree(t => t.result().state)).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "group": {
          "matches": "skipped",
        },
        "group matches": "passed",
      },
    }
  `)
})
