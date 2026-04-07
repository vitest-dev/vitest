import type { TestCase } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('only runs .only tests across files', async () => {
  const { buildTree, stderr } = await runInlineTests({
    'a.test.js': `
      import { test } from 'vitest'
      test('test 1', { meta: { ran: true } }, () => {})
      test('test 2', { meta: { ran: true } }, () => {})
    `,
    'b.test.js': `
      import { test } from 'vitest'
      test('test 3', { meta: { ran: true } }, () => {})
      test.only('test 4', { meta: { ran: true } }, () => {})
    `,
  }, {
    experimental: { preParse: true },
    allowOnly: true,
  })

  expect(stderr).toBe('')
  expect(buildTree(t => ({ state: t.result().state, meta: t.meta() }))).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "test 1": {
          "meta": {},
          "state": "skipped",
        },
        "test 2": {
          "meta": {},
          "state": "skipped",
        },
      },
      "b.test.js": {
        "test 3": {
          "meta": {
            "ran": true,
          },
          "state": "skipped",
        },
        "test 4": {
          "meta": {
            "ran": true,
          },
          "state": "passed",
        },
      },
    }
  `)
})

test('runs all tests when no .only is present', async () => {
  const { buildTree, stderr } = await runInlineTests({
    'a.test.js': `
      import { test } from 'vitest'
      test('test 1', { meta: { ran: true } }, () => {})
    `,
    'b.test.js': `
      import { test } from 'vitest'
      test('test 2', { meta: { ran: true } }, () => {})
    `,
  }, {
    experimental: { preParse: true },
  })

  expect(stderr).toBe('')
  expect(buildTree(t => ({ state: t.result().state, meta: t.meta() }))).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "test 1": {
          "meta": {
            "ran": true,
          },
          "state": "passed",
        },
      },
      "b.test.js": {
        "test 2": {
          "meta": {
            "ran": true,
          },
          "state": "passed",
        },
      },
    }
  `)
})

test('filters tests by testNamePattern', async () => {
  const { buildTree, stderr } = await runInlineTests({
    'a.test.js': `
      import { test } from 'vitest'
      test('hello world', { meta: { ran: true } }, () => {})
      test('foo bar', { meta: { ran: true } }, () => {})
    `,
    'b.test.js': `
      import { test } from 'vitest'
      test('another foo', { meta: { ran: true } }, () => {})
      test('unrelated', { meta: { ran: true } }, () => {})
    `,
  }, {
    experimental: { preParse: true },
    testNamePattern: 'foo',
  })

  expect(stderr).toBe('')
  expect(buildTree(t => ({ state: t.result().state, meta: t.meta() }))).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "foo bar": {
          "meta": {
            "ran": true,
          },
          "state": "passed",
        },
        "hello world": {
          "meta": {
            "ran": true,
          },
          "state": "skipped",
        },
      },
      "b.test.js": {
        "another foo": {
          "meta": {
            "ran": true,
          },
          "state": "passed",
        },
        "unrelated": {
          "meta": {
            "ran": true,
          },
          "state": "skipped",
        },
      },
    }
  `)
})

test('does not execute files where all tests are filtered by testNamePattern', async () => {
  const { buildTree, stderr } = await runInlineTests({
    'a.test.js': `
      import { test } from 'vitest'
      test('hello world', { meta: { ran: true } }, () => {})
    `,
    'b.test.js': `
      import { test } from 'vitest'
      test('foo bar', { meta: { ran: true } }, () => {})
    `,
  }, {
    experimental: { preParse: true },
    testNamePattern: 'foo',
  })

  expect(stderr).toBe('')
  expect(buildTree((t: TestCase) => ({ state: t.result().state, meta: t.meta() }))).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "hello world": {
          "meta": {},
          "state": "skipped",
        },
      },
      "b.test.js": {
        "foo bar": {
          "meta": {
            "ran": true,
          },
          "state": "passed",
        },
      },
    }
  `)
})

test('handles describe.only across files', async () => {
  const { buildTree, stderr } = await runInlineTests({
    'a.test.js': `
      import { describe, test } from 'vitest'
      describe('suite a', () => {
        test('test 1', { meta: { ran: true } }, () => {})
      })
    `,
    'b.test.js': `
      import { describe, test } from 'vitest'
      describe.only('suite b', () => {
        test('test 2', { meta: { ran: true } }, () => {})
      })
    `,
  }, {
    experimental: { preParse: true },
    allowOnly: true,
  })

  expect(stderr).toBe('')
  expect(buildTree((t: TestCase) => ({ state: t.result().state, meta: t.meta() }))).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "suite a": {
          "test 1": {
            "meta": {},
            "state": "skipped",
          },
        },
      },
      "b.test.js": {
        "suite b": {
          "test 2": {
            "meta": {
              "ran": true,
            },
            "state": "passed",
          },
        },
      },
    }
  `)
})
