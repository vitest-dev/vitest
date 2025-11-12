import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

function createTest({
  context = '/* context */',
  globalPrelude = '/* global-prelude */',
  imports = '/* imports */',
  options = '/* options */',
  prelude = '/* prelude */',
}: Partial<
  Record<
    | 'context'
    | 'globalPrelude'
    | 'imports'
    | 'options'
    | 'prelude',
    string
  >
>) {
  return /* ts */`
  import {
    test,
    describe,
    recordArtifact,
    ${imports}
  } from 'vitest'

  function toMatchTest(this, expected) {
    if (this.task.name !== expected) {
      return { pass: false, message: () => 'Active: "' + this.task.name + '"\\nExpected: "' + expected + '"' }
    }

    return { pass: true, message: () => undefined }
  }

  ${globalPrelude}

  describe('tests', { ${options} }, async () => {
    test('first', async ({ ${context} }) => {
      ${prelude}
      const { promise, resolve } = Promise.withResolvers()
      setTimeout(resolve, 100)
      await promise

      expect('first').toMatchTest()
    })

    test('second', ({ ${context} }) => {
      ${prelude}
      expect('second').toMatchTest()
    })
  })
`
}

const values = {
  extend: 'expect.extend({ toMatchTest })',
  expect: 'expect',
  concurrent: 'concurrent: true',
  task: 'task',
  createExpect: 'createExpect',
  initExpect: 'const expect = createExpect(task)',
}

describe('serial', () => {
  test.for([
    {
      name: 'globals & global extend',
      test: createTest({ globalPrelude: values.extend }),
      options: { globals: true },
    },
    {
      name: 'globals & local extend',
      test: createTest({ prelude: values.extend }),
      options: { globals: true },
    },
    {
      name: 'global import & global extend',
      test: createTest({ imports: values.expect, globalPrelude: values.extend }),
    },
    {
      name: 'global import & local extend',
      test: createTest({ imports: values.expect, prelude: values.extend }),
    },
    {
      name: 'context destructuring & global extend',
      test: createTest({ imports: values.expect, globalPrelude: values.extend, context: values.expect }),
    },
    {
      name: 'context destructuring & local extend',
      test: createTest({ context: values.expect, prelude: values.extend }),
    },
    {
      name: 'test-bound extend & global extend',
      test: createTest({ imports: `${values.expect},${values.createExpect}`, globalPrelude: values.extend, context: values.task, prelude: values.initExpect }),
    },
    {
      name: 'test-bound extend & local extend',
      test: createTest({ imports: values.createExpect, context: values.task, prelude: `${values.initExpect}; ${values.extend}` }),
    },
  ] as const)('works with $name', async ({ options, test }) => {
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

describe('concurrent', () => {
  test.for([
    {
      name: 'globals & global extend',
      test: createTest({ globalPrelude: values.extend, options: values.concurrent }),
      options: { globals: true },
    },
    {
      name: 'globals & local extend',
      test: createTest({ prelude: values.extend, options: values.concurrent }),
      options: { globals: true },
    },
    {
      name: 'global import & global extend',
      test: createTest({ imports: values.expect, globalPrelude: values.extend, options: values.concurrent }),
    },
    {
      name: 'global import & local extend',
      test: createTest({ imports: values.expect, prelude: values.extend, options: values.concurrent }),
    },
    {
      name: 'context destructuring & global extend',
      test: createTest({ imports: values.expect, globalPrelude: values.extend, context: values.expect, options: values.concurrent }),
    },
    {
      name: 'context destructuring & local extend',
      test: createTest({ context: values.expect, prelude: values.extend, options: values.concurrent }),
    },
    {
      name: 'test-bound extend & global extend',
      test: createTest({ imports: `${values.expect},${values.createExpect}`, globalPrelude: values.extend, context: values.task, prelude: values.initExpect, options: values.concurrent }),
    },
    {
      name: 'test-bound extend & local extend',
      test: createTest({ imports: values.createExpect, context: values.task, prelude: `${values.initExpect}; ${values.extend}`, options: values.concurrent }),
    },
  ] as const)('fails with $name', async ({ options, test }) => {
    const { stdout, ctx } = await runInlineTests(
      {
        'basic.test.ts': test,
      },
      { reporters: ['tap'], ...options },
    )

    // !!! these tests are failing, context is lost in concurrent mode
    expect(
      stdout
        .replace(/[\d.]+m?s/g, '<time>')
        .replace(ctx!.config.root, '<root>'),
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
                      message: "Active: \\"second\\"
      Expected: \\"first\\""
                  at: "<root>/basic.test.ts:26:23"
                  ...
              ok 2 - second # time=<time>
          }
      }
      "
    `)
  })
})
