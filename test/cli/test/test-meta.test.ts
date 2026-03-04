import type { TestCase, TestSuite } from 'vitest/node'
import { runInlineTests } from '#test-utils'
import { expect, test } from 'vitest'

test('meta can be defined on test options', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      test('test 1', { meta: { custom: 'value', count: 42 } }, () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testCase = testModule.children.at(0) as TestCase
  expect(testCase.meta()).toMatchInlineSnapshot(`
    {
      "count": 42,
      "custom": "value",
    }
  `)
})

test('meta can be defined on suite options', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe('suite', { meta: { suiteKey: 'suiteValue' } }, () => {
        test('test 1', () => {})
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testSuite = testModule.children.at(0) as TestSuite
  expect(testSuite.meta()).toMatchInlineSnapshot(`
    {
      "suiteKey": "suiteValue",
    }
  `)
})

test('test inherits meta from parent suite', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe('suite', { meta: { inherited: true, level: 'suite' } }, () => {
        test('test 1', () => {})
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testSuite = testModule.children.at(0) as TestSuite
  const testCase = testSuite.children.at(0) as TestCase
  expect(testCase.meta()).toMatchInlineSnapshot(`
    {
      "inherited": true,
      "level": "suite",
    }
  `)
})

test('test meta overrides inherited suite meta', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe('suite', { meta: { shared: 'fromSuite', suiteOnly: true } }, () => {
        test('test 1', { meta: { shared: 'fromTest', testOnly: 123 } }, () => {})
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testSuite = testModule.children.at(0) as TestSuite
  const testCase = testSuite.children.at(0) as TestCase
  expect(testCase.meta()).toMatchInlineSnapshot(`
    {
      "shared": "fromTest",
      "suiteOnly": true,
      "testOnly": 123,
    }
  `)
})

test('nested suites inherit meta from parent suites', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe('outer', { meta: { outer: true } }, () => {
        describe('inner', { meta: { inner: true } }, () => {
          test('test 1', () => {})
        })
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const outerSuite = testModule.children.at(0) as TestSuite
  const innerSuite = outerSuite.children.at(0) as TestSuite
  const testCase = innerSuite.children.at(0) as TestCase

  expect(outerSuite.meta()).toMatchInlineSnapshot(`
    {
      "outer": true,
    }
  `)
  expect(innerSuite.meta()).toMatchInlineSnapshot(`
    {
      "inner": true,
      "outer": true,
    }
  `)
  expect(testCase.meta()).toMatchInlineSnapshot(`
    {
      "inner": true,
      "outer": true,
    }
  `)
})

test('deeply nested meta inheritance with overrides', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe('level1', { meta: { level: 1, a: 'first' } }, () => {
        describe('level2', { meta: { level: 2, b: 'second' } }, () => {
          describe('level3', { meta: { level: 3, a: 'override' } }, () => {
            test('test 1', { meta: { level: 4 } }, () => {})
          })
        })
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const level1 = testModule.children.at(0) as TestSuite
  const level2 = level1.children.at(0) as TestSuite
  const level3 = level2.children.at(0) as TestSuite
  const testCase = level3.children.at(0) as TestCase

  expect(level1.meta()).toMatchInlineSnapshot(`
    {
      "a": "first",
      "level": 1,
    }
  `)
  expect(level2.meta()).toMatchInlineSnapshot(`
    {
      "a": "first",
      "b": "second",
      "level": 2,
    }
  `)
  expect(level3.meta()).toMatchInlineSnapshot(`
    {
      "a": "override",
      "b": "second",
      "level": 3,
    }
  `)
  expect(testCase.meta()).toMatchInlineSnapshot(`
    {
      "a": "override",
      "b": "second",
      "level": 4,
    }
  `)
})

test('meta is accessible from task.meta inside tests', async () => {
  const { stderr, stdout } = await runInlineTests({
    'basic.test.js': `
      describe('suite', { meta: { suiteKey: 'inherited' } }, () => {
        test('test 1', { meta: { testKey: 'own' } }, ({ task }) => {
          console.log('META:', JSON.stringify(task.meta))
        })
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const metaLine = stdout.split('\n').find(line => line.startsWith('META:'))
  expect(metaLine).toBeDefined()
  expect(JSON.parse(metaLine!.slice('META:'.length))).toMatchInlineSnapshot(`
    {
      "suiteKey": "inherited",
      "testKey": "own",
    }
  `)
})

test('sibling tests have independent meta', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe('suite', { meta: { shared: 'parent' } }, () => {
        test('test 1', { meta: { id: 1 } }, () => {})
        test('test 2', { meta: { id: 2 } }, () => {})
        test('test 3', () => {})
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testSuite = testModule.children.at(0) as TestSuite
  const [test1, test2, test3] = testSuite.children.array() as TestCase[]

  expect(test1.meta()).toMatchInlineSnapshot(`
    {
      "id": 1,
      "shared": "parent",
    }
  `)
  expect(test2.meta()).toMatchInlineSnapshot(`
    {
      "id": 2,
      "shared": "parent",
    }
  `)
  expect(test3.meta()).toMatchInlineSnapshot(`
    {
      "shared": "parent",
    }
  `)
})

test('sibling suites have independent meta', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe('suite1', { meta: { suite: 1 } }, () => {
        test('test 1', () => {})
      })
      describe('suite2', { meta: { suite: 2 } }, () => {
        test('test 2', () => {})
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const [suite1, suite2] = testModule.children.array() as TestSuite[]
  const test1 = suite1.children.at(0) as TestCase
  const test2 = suite2.children.at(0) as TestCase

  expect(suite1.meta()).toMatchInlineSnapshot(`
    {
      "suite": 1,
    }
  `)
  expect(suite2.meta()).toMatchInlineSnapshot(`
    {
      "suite": 2,
    }
  `)
  expect(test1.meta()).toMatchInlineSnapshot(`
    {
      "suite": 1,
    }
  `)
  expect(test2.meta()).toMatchInlineSnapshot(`
    {
      "suite": 2,
    }
  `)
})

test('test without parent suite has empty meta', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      test('test 1', () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testCase = testModule.children.at(0) as TestCase
  expect(testCase.meta()).toMatchInlineSnapshot(`{}`)
})

test('test.each works with meta', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe('suite', { meta: { feature: 'each' } }, () => {
        test.each([1, 2, 3])('test %i', { meta: { eachTest: true } }, () => {})
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testSuite = testModule.children.at(0) as TestSuite
  const tests = testSuite.children.array() as TestCase[]

  expect(tests).toHaveLength(3)
  for (const test of tests) {
    expect(test.meta()).toMatchInlineSnapshot(`
      {
        "eachTest": true,
        "feature": "each",
      }
    `)
  }
})

test('describe.each works with meta', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe.each([1, 2])('suite %i', { meta: { dynamic: true } }, () => {
        test('test', () => {})
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const [suite1, suite2] = testModule.children.array() as TestSuite[]

  expect(suite1.meta()).toMatchInlineSnapshot(`
    {
      "dynamic": true,
    }
  `)
  expect(suite2.meta()).toMatchInlineSnapshot(`
    {
      "dynamic": true,
    }
  `)
  expect((suite1.children.at(0) as TestCase).meta()).toMatchInlineSnapshot(`
    {
      "dynamic": true,
    }
  `)
})

test('concurrent tests have independent meta', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe('suite', { meta: { shared: true } }, () => {
        test.concurrent('test 1', { meta: { id: 1 } }, () => {})
        test.concurrent('test 2', { meta: { id: 2 } }, () => {})
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testSuite = testModule.children.at(0) as TestSuite
  const [test1, test2] = testSuite.children.array() as TestCase[]

  expect(test1.meta()).toMatchInlineSnapshot(`
    {
      "id": 1,
      "shared": true,
    }
  `)
  expect(test2.meta()).toMatchInlineSnapshot(`
    {
      "id": 2,
      "shared": true,
    }
  `)
})

test('meta with complex values', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      test('test 1', {
        meta: {
          nested: { a: { b: { c: 1 } } },
          array: [1, 2, 3],
          nullValue: null,
          boolTrue: true,
          boolFalse: false,
          num: 42.5,
        }
      }, () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testCase = testModule.children.at(0) as TestCase
  expect(testCase.meta()).toMatchInlineSnapshot(`
    {
      "array": [
        1,
        2,
        3,
      ],
      "boolFalse": false,
      "boolTrue": true,
      "nested": {
        "a": {
          "b": {
            "c": 1,
          },
        },
      },
      "nullValue": null,
      "num": 42.5,
    }
  `)
})

test('meta works with test modifiers (skip, only, todo)', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      test.skip('skipped test', { meta: { status: 'skipped' } }, () => {})
      test.todo('todo test', { meta: { status: 'todo' } })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const [skipped, todo] = testModule.children.array() as TestCase[]

  expect(skipped.meta()).toMatchInlineSnapshot(`
    {
      "status": "skipped",
    }
  `)
  expect(todo.meta()).toMatchInlineSnapshot(`
    {
      "status": "todo",
    }
  `)
})

test('meta works with test.fails', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      test.fails('failing test', { meta: { expectFailure: true } }, () => {
        throw new Error('Expected error')
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testCase = testModule.children.at(0) as TestCase
  expect(testCase.meta()).toMatchInlineSnapshot(`
    {
      "expectFailure": true,
    }
  `)
  expect(testCase.result().state).toBe('passed')
})

test('suite without meta does not inherit to tests', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe('suite without meta', () => {
        test('test with meta', { meta: { ownMeta: true } }, () => {})
        test('test without meta', () => {})
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testSuite = testModule.children.at(0) as TestSuite
  const [withMeta, withoutMeta] = testSuite.children.array() as TestCase[]

  expect(testSuite.meta()).toMatchInlineSnapshot(`{}`)
  expect(withMeta.meta()).toMatchInlineSnapshot(`
    {
      "ownMeta": true,
    }
  `)
  expect(withoutMeta.meta()).toMatchInlineSnapshot(`{}`)
})

test('meta does not mutate parent when child overrides', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe('parent', { meta: { key: 'parent', parentOnly: true } }, () => {
        describe('child', { meta: { key: 'child', childOnly: true } }, () => {
          test('test', () => {})
        })
        test('sibling test', () => {})
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const parent = testModule.children.at(0) as TestSuite
  const child = parent.children.at(0) as TestSuite
  const siblingTest = parent.children.at(1) as TestCase

  expect(parent.meta()).toMatchInlineSnapshot(`
    {
      "key": "parent",
      "parentOnly": true,
    }
  `)
  expect(child.meta()).toMatchInlineSnapshot(`
    {
      "childOnly": true,
      "key": "child",
      "parentOnly": true,
    }
  `)
  expect(siblingTest.meta()).toMatchInlineSnapshot(`
    {
      "key": "parent",
      "parentOnly": true,
    }
  `)
})

test('meta with test.for', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe('suite', { meta: { fromSuite: true } }, () => {
        test.for([
          { input: 1, expected: 2 },
          { input: 2, expected: 4 },
        ])('test $input', { meta: { forTest: true } }, ({ input, expected }) => {
          expect(input * 2).toBe(expected)
        })
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testSuite = testModule.children.at(0) as TestSuite
  const tests = testSuite.children.array() as TestCase[]

  expect(tests).toHaveLength(2)
  for (const test of tests) {
    expect(test.meta()).toMatchInlineSnapshot(`
      {
        "forTest": true,
        "fromSuite": true,
      }
    `)
  }
})

test('empty meta object is allowed', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe('suite', { meta: {} }, () => {
        test('test', { meta: {} }, () => {})
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testSuite = testModule.children.at(0) as TestSuite
  const testCase = testSuite.children.at(0) as TestCase

  expect(testSuite.meta()).toMatchInlineSnapshot(`{}`)
  expect(testCase.meta()).toMatchInlineSnapshot(`{}`)
})

test('meta inheritance across multiple files', async () => {
  const { stderr, ctx } = await runInlineTests({
    'file1.test.js': `
      describe('suite in file1', { meta: { file: 1 } }, () => {
        test('test 1', () => {})
      })
    `,
    'file2.test.js': `
      describe('suite in file2', { meta: { file: 2 } }, () => {
        test('test 2', () => {})
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  const testModules = ctx!.state.getTestModules()
  const file1Module = testModules.find(m => m.moduleId.includes('file1'))!
  const file2Module = testModules.find(m => m.moduleId.includes('file2'))!

  const suite1 = file1Module.children.at(0) as TestSuite
  const suite2 = file2Module.children.at(0) as TestSuite
  const test1 = suite1.children.at(0) as TestCase
  const test2 = suite2.children.at(0) as TestCase

  expect(test1.meta()).toMatchInlineSnapshot(`
    {
      "file": 1,
    }
  `)
  expect(test2.meta()).toMatchInlineSnapshot(`
    {
      "file": 2,
    }
  `)
})
