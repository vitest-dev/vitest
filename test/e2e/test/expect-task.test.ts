import { describe, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

const toMatchTest = /* ts */`
export function toMatchTest(this, expected) {
  if (this.task?.name !== expected) {
    return { pass: false, message: () => 'Active: "' + this.task?.name + '"\\nExpected: "' + expected + '"' }
  }

  return { pass: true, message: () => undefined }
}

export function delay() {
  return new Promise(resolve => {
    setTimeout(resolve, 100)
  })
}
`

const globals = /* ts */`
  import { test, describe } from 'vitest'
  import { delay, toMatchTest } from './to-match-test.ts'

  expect.extend({ toMatchTest })

  describe('tests', { /* options */ }, async () => {
    test('first', async () => {
      await delay()

      expect('first').toMatchTest()
    })

    test('second', () => {
      expect('second').toMatchTest()
    })
  })
`

const globalImport = /* ts */`
  import { test, describe, expect } from 'vitest'
  import { delay, toMatchTest } from './to-match-test.ts'

  expect.extend({ toMatchTest })

  describe('tests', { /* options */ }, async () => {
    test('first', async () => {
      await delay()

      expect('first').toMatchTest()
    })

    test('second', () => {
      expect('second').toMatchTest()
    })
  })
`

const fromContextGlobalExtend = /* ts */`
  import { test, describe, expect } from 'vitest'
  import { delay, toMatchTest } from './to-match-test.ts'

  expect.extend({ toMatchTest })

  describe('tests', { /* options */ }, async () => {
    test('first', async ({ expect }) => {
      await delay()

      expect('first').toMatchTest()
    })

    test('second', ({ expect }) => {
      expect('second').toMatchTest()
    })
  })
`

const fromContextLocalExtend = /* ts */`
  import { test, describe } from 'vitest'
  import { delay, toMatchTest } from './to-match-test.ts'

  describe('tests', { /* options */ }, async () => {
    test('first', async ({ expect }) => {
      expect.extend({ toMatchTest })

      await delay()

      expect('first').toMatchTest()
    })

    test('second', ({ expect }) => {
      expect.extend({ toMatchTest })

      expect('second').toMatchTest()
    })
  })
`

const testBoundGlobalExtend = /* ts */`
  import { test, describe, expect, createExpect } from 'vitest'
  import { delay, toMatchTest } from './to-match-test.ts'

  expect.extend({ toMatchTest })

  describe('tests', { /* options */ }, async () => {
    test('first', async ({ task }) => {
      const expect = createExpect(task)

      await delay()

      expect('first').toMatchTest()
    })

    test('second', ({ task }) => {
      const expect = createExpect(task)

      expect('second').toMatchTest()
    })
  })
`

const testBoundLocalExtend = /* ts */`
  import { test, describe, createExpect } from 'vitest'
  import { delay, toMatchTest } from './to-match-test.ts'

  describe('tests', { /* options */ }, async () => {
    test('first', async ({ task }) => {
      const expect = createExpect(task)
      expect.extend({ toMatchTest })

      await delay()

      expect('first').toMatchTest()
    })

    test('second', ({ task }) => {
      const expect = createExpect(task)
      expect.extend({ toMatchTest })

      expect('second').toMatchTest()
    })
  })
`

function withConcurrency(test: string): string {
  return test.replace('/* options */', 'concurrent: true')
}

describe('serial', { concurrent: true }, () => {
  test.for([
    {
      name: 'globals',
      test: globals,
      options: { globals: true },
    },
    {
      name: 'global import',
      test: globalImport,
    },
    {
      name: 'context destructuring & global extend',
      test: fromContextGlobalExtend,
    },
    {
      name: 'context destructuring & local extend',
      test: fromContextLocalExtend,
    },
    {
      name: 'test-bound extend & global extend',
      test: testBoundGlobalExtend,
    },
    {
      name: 'test-bound extend & local extend',
      test: testBoundLocalExtend,
    },
  ] as const)('works with $name', async ({ options, test }, { task, expect }) => {
    const { stdout, stderr } = await runInlineTests(
      {
        'basic.test.ts': test,
        'to-match-test.ts': toMatchTest,
      },
      { reporters: ['tap'], ...options },
      undefined,
      task,
    )

    expect(stderr).toBe('')
    expect(stdout.replace(/[\d.]+ms/g, '<time>')).toMatchInlineSnapshot(`
      "TAP version 13
      1..1
      ok 1 - basic.test.ts # time=<time> {
          1..1
          ok 1 - tests # time=<time> {
              1..2
              ok 1 - first # time=<time>
              ok 2 - second # time=<time>
          }
      }
      "
    `)
  })
})

describe('concurrent', { concurrent: true }, () => {
  // when using globals or global `expect`, context is "lost" or not tracked in concurrent mode
  test.for([
    {
      name: 'globals',
      test: withConcurrency(globals),
      options: { globals: true },
    },
    {
      name: 'global import',
      test: withConcurrency(globalImport),
    },
  ] as const)('fails with $name', async ({ options, test }, { task, expect }) => {
    const { stdout, ctx } = await runInlineTests(
      {
        'basic.test.ts': test,
        'to-match-test.ts': toMatchTest,
      },
      { reporters: ['tap'], ...options },
      undefined,
      task,
    )

    expect(
      stdout
        .replace(/[\d.]+m?s/g, '<time>')
        .replace(ctx!.config.root, '<root>')
        .replace(/:\d+:\d+/, ':<line>:<column>'),
    ).toMatchInlineSnapshot(`
      "TAP version 13
      1..1
      not ok 1 - basic.test.ts # time=<time> {
          1..1
          not ok 1 - tests # time=<time> {
              1..2
              not ok 1 - first # time=<time>
                  ---
                  error:
                      name: "Error"
                      message: "Active: \\"undefined\\"
      Expected: \\"first\\""
                  at: "<root>/basic.test.ts:<line>:<column>"
                  ...
              ok 2 - second # time=<time>
          }
      }
      "
    `)
  })

  test.for([
    {
      name: 'context destructuring & global extend',
      test: withConcurrency(fromContextGlobalExtend),
    },
    {
      name: 'context destructuring & local extend',
      test: withConcurrency(fromContextLocalExtend),
    },
    {
      name: 'test-bound extend & global extend',
      test: withConcurrency(testBoundGlobalExtend),
    },
    {
      name: 'test-bound extend & local extend',
      test: withConcurrency(testBoundLocalExtend),
    },
  ])('works with $name', async ({ test }, { task, expect }) => {
    const { stdout } = await runInlineTests(
      {
        'basic.test.ts': test,
        'to-match-test.ts': toMatchTest,
      },
      { reporters: ['tap'] },
      undefined,
      task,
    )

    expect(stdout.replace(/[\d.]+m?s/g, '<time>')).toMatchInlineSnapshot(`
      "TAP version 13
      1..1
      ok 1 - basic.test.ts # time=<time> {
          1..1
          ok 1 - tests # time=<time> {
              1..2
              ok 1 - first # time=<time>
              ok 2 - second # time=<time>
          }
      }
      "
    `)
  })
})
