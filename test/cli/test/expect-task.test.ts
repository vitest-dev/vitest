import { test } from 'vitest'
import { runInlineTests } from '../../test-utils'

const globalsGlobalExtend = /* ts */`
  import { test, describe } from 'vitest'

  function toMatchTest(this, expected) {
    if (this.task?.name !== expected) {
      return { pass: false, message: () => 'Active: "' + this.task?.name + '"\\nExpected: "' + expected + '"' }
    }

    return { pass: true, message: () => undefined }
  }

  expect.extend({ toMatchTest })

  describe('tests', { /* options */ }, async () => {
    test('first', async () => {
      const { promise, resolve } = Promise.withResolvers()
      setTimeout(resolve, 100)
      await promise

      expect('first').toMatchTest()
    })

    test('second', () => {
      expect('second').toMatchTest()
    })
  })
`

const globalsLocalExtend = /* ts */`
  import { test, describe } from 'vitest'

  function toMatchTest(this, expected) {
    if (this.task?.name !== expected) {
      return { pass: false, message: () => 'Active: "' + this.task?.name + '"\\nExpected: "' + expected + '"' }
    }

    return { pass: true, message: () => undefined }
  }

  describe('tests', { /* options */ }, async () => {
    test('first', async () => {
      expect.extend({ toMatchTest })

      const { promise, resolve } = Promise.withResolvers()
      setTimeout(resolve, 100)
      await promise

      expect('first').toMatchTest()
    })

    test('second', () => {
      expect.extend({ toMatchTest })
      expect('second').toMatchTest()
    })
  })
`

const globalImportGlobalExtend = /* ts */`
  import { test, describe, expect } from 'vitest'

  function toMatchTest(this, expected) {
    if (this.task?.name !== expected) {
      return { pass: false, message: () => 'Active: "' + this.task?.name + '"\\nExpected: "' + expected + '"' }
    }

    return { pass: true, message: () => undefined }
  }

  expect.extend({ toMatchTest })

  describe('tests', { /* options */ }, async () => {
    test('first', async () => {
      const { promise, resolve } = Promise.withResolvers()
      setTimeout(resolve, 100)
      await promise

      expect('first').toMatchTest()
    })

    test('second', () => {
      expect('second').toMatchTest()
    })
  })
`

const globalImportLocalExtend = /* ts */`
  import { test, describe, expect } from 'vitest'

  function toMatchTest(this, expected) {
    if (this.task?.name !== expected) {
      return { pass: false, message: () => 'Active: "' + this.task?.name + '"\\nExpected: "' + expected + '"' }
    }

    return { pass: true, message: () => undefined }
  }

  describe('tests', { /* options */ }, async () => {
    test('first', async () => {
      expect.extend({ toMatchTest })

      const { promise, resolve } = Promise.withResolvers()
      setTimeout(resolve, 100)
      await promise

      expect('first').toMatchTest()
    })

    test('second', () => {
      expect.extend({ toMatchTest })

      expect('second').toMatchTest()
    })
  })
`

const contextGlobalExtend = /* ts */`
  import { test, describe, expect } from 'vitest'

  function toMatchTest(this, expected) {
    if (this.task?.name !== expected) {
      return { pass: false, message: () => 'Active: "' + this.task?.name + '"\\nExpected: "' + expected + '"' }
    }

    return { pass: true, message: () => undefined }
  }

  expect.extend({ toMatchTest })

  describe('tests', { /* options */ }, async () => {
    test('first', async ({ expect }) => {
      const { promise, resolve } = Promise.withResolvers()
      setTimeout(resolve, 100)
      await promise

      expect('first').toMatchTest()
    })

    test('second', ({ expect }) => {
      expect('second').toMatchTest()
    })
  })
`

const contextLocalExtend = /* ts */`
  import { test, describe } from 'vitest'

  function toMatchTest(this, expected) {
    if (this.task?.name !== expected) {
      return { pass: false, message: () => 'Active: "' + this.task?.name + '"\\nExpected: "' + expected + '"' }
    }

    return { pass: true, message: () => undefined }
  }

  describe('tests', { /* options */ }, async () => {
    test('first', async ({ expect }) => {
      expect.extend({ toMatchTest })

      const { promise, resolve } = Promise.withResolvers()
      setTimeout(resolve, 100)
      await promise

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

  function toMatchTest(this, expected) {
    if (this.task?.name !== expected) {
      return { pass: false, message: () => 'Active: "' + this.task?.name + '"\\nExpected: "' + expected + '"' }
    }

    return { pass: true, message: () => undefined }
  }

  expect.extend({ toMatchTest })

  describe('tests', { /* options */ }, async () => {
    test('first', async ({ task }) => {
      const expect = createExpect(task)

      const { promise, resolve } = Promise.withResolvers()
      setTimeout(resolve, 100)
      await promise

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

  function toMatchTest(this, expected) {
    if (this.task?.name !== expected) {
      return { pass: false, message: () => 'Active: "' + this.task?.name + '"\\nExpected: "' + expected + '"' }
    }

    return { pass: true, message: () => undefined }
  }

  describe('tests', { /* options */ }, async () => {
    test('first', async ({ task }) => {
      const expect = createExpect(task)
      expect.extend({ toMatchTest })

      const { promise, resolve } = Promise.withResolvers()
      setTimeout(resolve, 100)
      await promise

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
      name: 'globals & global extend',
      test: globalsGlobalExtend,
      options: { globals: true },
    },
    {
      name: 'globals & local extend',
      test: globalsLocalExtend,
      options: { globals: true },
    },
    {
      name: 'global import & global extend',
      test: globalImportGlobalExtend,
    },
    {
      name: 'global import & local extend',
      test: globalImportLocalExtend,
    },
    {
      name: 'context destructuring & global extend',
      test: contextGlobalExtend,
    },
    {
      name: 'context destructuring & local extend',
      test: contextLocalExtend,
    },
    {
      name: 'test-bound extend & global extend',
      test: testBoundGlobalExtend,
    },
    {
      name: 'test-bound extend & local extend',
      test: testBoundLocalExtend,
    },
  ] as const)('works with $name', async ({ options, test }, { expect }) => {
    const { stdout } = await runInlineTests(
      {
        'basic.test.ts': test,
      },
      { reporters: ['tap'], ...options },
    )

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
      name: 'globals & global extend',
      test: withConcurrency(globalsGlobalExtend),
      options: { globals: true },
    },
    {
      name: 'globals & local extend',
      test: withConcurrency(globalsLocalExtend),
      options: { globals: true },
    },
    {
      name: 'global import & global extend',
      test: withConcurrency(globalImportGlobalExtend),
    },
    {
      name: 'global import & local extend',
      test: withConcurrency(globalImportLocalExtend),
    },
  ] as const)('fails with $name', async ({ options, test }, { expect }) => {
    const { stdout, ctx } = await runInlineTests(
      {
        'basic.test.ts': test,
      },
      { reporters: ['tap'], ...options },
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
      test: withConcurrency(contextGlobalExtend),
    },
    {
      name: 'context destructuring & local extend',
      test: withConcurrency(contextLocalExtend),
    },
    {
      name: 'test-bound extend & global extend',
      test: withConcurrency(testBoundGlobalExtend),
    },
    {
      name: 'test-bound extend & local extend',
      test: withConcurrency(testBoundLocalExtend),
    },
  ])('works with $name', async ({ test }, { expect }) => {
    const { stdout } = await runInlineTests(
      {
        'basic.test.ts': test,
      },
      { reporters: ['tap'] },
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
