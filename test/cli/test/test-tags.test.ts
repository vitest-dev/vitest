import type { TestModule, TestSuite } from 'vitest/node'
import { runInlineTests, runVitest } from '#test-utils'
import { expect, test } from 'vitest'

test('vitest records tags', async () => {
  const { stderr, ctx } = await runVitest({
    root: './fixtures/test-tags',
    config: false,
    tags: [
      { name: 'suite' },
      { name: 'test' },
      { name: 'suite 2' },
      { name: 'test 2' },
    ],
  })

  expect(stderr).toBe('')
  expect(getTestTree(ctx!.state.getTestModules()[0])).toMatchInlineSnapshot(`
    {
      "suite 1": {
        "suite 2": {
          "test 3": [
            "suite",
            "suite 2",
          ],
          "test 4": [
            "suite",
            "suite 2",
            "test 2",
          ],
        },
        "test 1": [
          "suite",
        ],
        "test 2": [
          "suite",
          "test",
        ],
      },
    }
  `)
})

test('filters tests based on --tag=!ignore', async () => {
  const { stderr, testTree } = await runVitest({
    root: './fixtures/test-tags',
    config: false,
    tags: [
      { name: 'suite' },
      { name: 'test' },
      { name: 'suite 2' },
      { name: 'test 2' },
    ],
    tag: ['!suite 2'],
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "suite 1": {
          "suite 2": {
            "test 3": "skipped",
            "test 4": "skipped",
          },
          "test 1": "passed",
          "test 2": "passed",
        },
      },
    }
  `)
})

test('filters tests based on --tag=!ignore and --tag=include', async () => {
  const { stderr, testTree } = await runVitest({
    root: './fixtures/test-tags',
    config: false,
    tags: [
      { name: 'suite' },
      { name: 'test' },
      { name: 'suite 2' },
      { name: 'test 2' },
    ],
    tag: ['!suite 2', 'test'],
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "suite 1": {
          "suite 2": {
            "test 3": "skipped",
            "test 4": "skipped",
          },
          "test 1": "skipped",
          "test 2": "passed",
        },
      },
    }
  `)
})

test('filters tests based on --tag=include', async () => {
  const { stderr, testTree } = await runVitest({
    root: './fixtures/test-tags',
    config: false,
    tags: [
      { name: 'suite' },
      { name: 'test' },
      { name: 'suite 2' },
      { name: 'test 2' },
    ],
    tag: ['test*'],
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "suite 1": {
          "suite 2": {
            "test 3": "skipped",
            "test 4": "passed",
          },
          "test 1": "skipped",
          "test 2": "passed",
        },
      },
    }
  `)
})

test('throws an error if no tags are defined in the config, but in the test', async () => {
  const { stderr } = await runInlineTests(
    {
      'basic.test.js': `
        test('test 1', { tags: ['unknown'] }, () => {})
      `,
    },
    { globals: true },
  )

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.js [ basic.test.js ]
    Error: The Vitest config does't define any "tags", cannot apply "unknown" tag for this test. See: https://vitest.dev/guide/test-tags
     ❯ basic.test.js:2:9
          1| 
          2|         test('test 1', { tags: ['unknown'] }, () => {})
           |         ^
          3|       

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('throws an error if tag is not defined in the config, but in the test', async () => {
  const { stderr } = await runInlineTests(
    {
      'basic.test.js': `
        test('test 1', { tags: ['unknown'] }, () => {})
      `,
    },
    {
      globals: true,
      tags: [{ name: 'known' }],
    },
  )

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.js [ basic.test.js ]
    Error: Tag "unknown" is not defined in the configuration. Available tags are: 
    - known
     ❯ basic.test.js:2:9
          1| 
          2|         test('test 1', { tags: ['unknown'] }, () => {})
           |         ^
          3|       

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('throws an error if tag is not defined in the config, but in --tag filter', async () => {
  const { stderr } = await runInlineTests(
    {
      'basic.test.js': '',
    },
    {
      tag: ['unknown'],
    },
    { fails: true },
  )
  expect(stderr).toContain('Cannot find any tags to filter based on the --tag unknown option. Did you define them in "test.tags" in your config?')
})

function getTestTree(testModule: TestModule | TestSuite, tree: Record<string, any> = {}) {
  for (const child of testModule.children) {
    if (child.type === 'suite') {
      tree[child.name] = {}
      getTestTree(child, tree[child.name])
    }
    else {
      tree[child.name] = child.options.tags
    }
  }
  return tree
}
