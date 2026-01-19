import type { TestCase, TestSuite } from 'vitest/node'
import { runInlineTests, runVitest } from '#test-utils'
import { expect, test } from 'vitest'

test('vitest records tags', async () => {
  const { stderr, buildTree } = await runVitest({
    root: './fixtures/test-tags',
    config: false,
    tags: [
      { name: 'alone' },
      { name: 'suite' },
      { name: 'test' },
      { name: 'suite 2' },
      { name: 'test 2' },
    ],
  })

  expect(stderr).toBe('')
  expect(getTestTree(buildTree)).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "suite 1": {
          "suite 2": {
            "test 3": [
              "suite",
              "alone",
              "suite 2",
            ],
            "test 4": [
              "suite",
              "alone",
              "suite 2",
              "test 2",
            ],
          },
          "test 1": [
            "suite",
            "alone",
          ],
          "test 2": [
            "suite",
            "alone",
            "test",
          ],
        },
      },
    }
  `)
})

test('filters tests based on --tag=!ignore', async () => {
  const { stderr, testTree } = await runVitest({
    root: './fixtures/test-tags',
    config: false,
    tags: [
      { name: 'alone' },
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
      { name: 'alone' },
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
      { name: 'alone' },
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
            "test 4": "skipped",
          },
          "test 1": "skipped",
          "test 2": "skipped",
        },
      },
    }
  `)
})

test.skip('throws an error if no tags are defined in the config, but in the test', async () => {
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

test.skip('throws an error if tag is not defined in the config, but in the test', async () => {
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

test.skip('throws an error if tag is not defined in the config, but in --tag filter', async () => {
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

test.todo('defining a tag available only in one project', async () => {
  await runVitest({
    config: false,
    tag: ['project-2-tag'],
    projects: [
      {
        test: {
          tags: [{ name: 'project-1-tag' }],
        },
      },
      {
        test: {
          tags: [{ name: 'project-2-tag' }],
        },
      },
    ],
  })
})

test('can specify custom options for tags', async () => {
  const { stderr, buildTree } = await runVitest({
    root: './fixtures/test-tags',
    config: false,
    tags: [
      { name: 'alone' },
      { name: 'suite', timeout: 1000 },
      { name: 'test', retry: 2, skip: true },
      { name: 'suite 2', repeats: 3 },
      { name: 'test 2', timeout: 500, retry: 1 },
    ],
  })
  expect(stderr).toBe('')
  expect(buildOptionsTree(buildTree)).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "suite 1": {
          "suite 2": {
            "test 3": {
              "mode": "run",
              "repeats": 3,
              "tags": [
                "suite",
                "alone",
                "suite 2",
              ],
              "timeout": 1000,
            },
            "test 4": {
              "mode": "run",
              "repeats": 3,
              "retry": 1,
              "tags": [
                "suite",
                "alone",
                "suite 2",
                "test 2",
              ],
              "timeout": 500,
            },
          },
          "test 1": {
            "mode": "run",
            "tags": [
              "suite",
              "alone",
            ],
            "timeout": 1000,
          },
          "test 2": {
            "mode": "skip",
            "retry": 2,
            "tags": [
              "suite",
              "alone",
              "test",
            ],
            "timeout": 1000,
          },
        },
      },
    }
  `)
})

test('can specify custom options with priorities for tags', async () => {
  const { stderr, ctx } = await runVitest({
    root: './fixtures/test-tags',
    config: false,
    tags: [
      { name: 'alone' },
      {
        name: 'test',
        timeout: 500,
        skip: false,
        concurrent: true,
        fails: false,
        priority: 1,
      },
      {
        name: 'suite',
        timeout: 1000,
        skip: true,
        concurrent: false,
        fails: true,
        priority: 2,
      },
      { name: 'suite 2' },
      { name: 'test 2' },
    ],
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testSuite = testModule.children.at(0) as TestSuite
  const testCase = testSuite.children.at(1) as TestCase

  expect(testCase.name).toBe('test 2')
  expect(testCase.options.tags).toEqual(['suite', 'alone', 'test'])
  // from 'test' tag (priority 1 is higher)
  expect(testCase.options.timeout).toBe(500)
  // concurrent is not set anywhere manually, so
  // test always gets it from the highest priority tag
  expect(testCase.options.concurrent).toBe(true)
  expect(testCase.options.fails).toBe(false)
  expect(testCase.result().state).toBe('passed')
})

test('custom options override tag options', async () => {
  const { stderr, buildTree } = await runInlineTests({
    'basic.test.js': `
      test.fails('test 1', { tags: ['test'], timeout: 2000, skip: false, repeats: 0 }, () => {
        throw new Error('fail')
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          {
            name: 'test',
            timeout: 500,
            skip: true,
            concurrent: true,
            fails: false,
            retry: 2,
            repeats: 2,
          },
        ],
      },
    },
  })
  expect(stderr).toBe('')
  expect(buildOptionsTree(buildTree)).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "test 1": {
          "concurrent": true,
          "fails": true,
          "mode": "run",
          "repeats": 0,
          "retry": 2,
          "tags": [
            "test",
          ],
          "timeout": 2000,
        },
      },
    }
  `)
})

test('@tag docs inject test tags', async () => {})
test('invalid @tag throws and error', async () => {})

function getTestTree(builder: (fn: (test: TestCase) => any) => any) {
  return builder(test => test.options.tags)
}

function buildOptionsTree(builder: (fn: (test: TestCase) => any) => any) {
  return builder(test => removeUndefined(test.options))
}

function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key]
    }
  }
  return result
}
