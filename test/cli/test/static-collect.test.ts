import type { CliOptions, TestCase, TestModule, TestSuite } from 'vitest/node'
import { expect, test } from 'vitest'
import { createVitest } from 'vitest/node'

test('correctly collects a simple test', async () => {
  const testModule = await collectTests(`
    import { test, expect } from 'vitest'

    describe('math operations', () => {
      test('adds numbers', () => {
        expect(1 + 1).toBe(2)
      })

      test.skip('subtracts numbers', () => {
        expect(2 - 1).toBe(1)
      })
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "math operations": {
        "adds numbers": {
          "fullName": "math operations > adds numbers",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "subtracts numbers": {
          "fullName": "math operations > subtracts numbers",
          "id": "-1732721377_0_1",
          "location": {
            "column": 6,
            "line": 9,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
      },
    }
  `)
})

test('collects tests starting with "test"', async () => {
  const testModule = await collectTests(`
    import { testSomething, testAnother } from './test-helpers'

    describe('custom test functions', () => {
      testSomething('works with testSomething', () => {})
      testAnother('works with testAnother', () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "custom test functions": {
        "works with testAnother": {
          "fullName": "custom test functions > works with testAnother",
          "id": "-1732721377_0_1",
          "location": {
            "column": 6,
            "line": 6,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "works with testSomething": {
          "fullName": "custom test functions > works with testSomething",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
      },
    }
  `)
})

test('collects tests ending with "Test"', async () => {
  const testModule = await collectTests(`
    import { unitTest, integrationTest } from './test-helpers'

    describe('custom test functions', () => {
      unitTest('works with unitTest', () => {})
      integrationTest('works with integrationTest', () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "custom test functions": {
        "works with integrationTest": {
          "fullName": "custom test functions > works with integrationTest",
          "id": "-1732721377_0_1",
          "location": {
            "column": 6,
            "line": 6,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "works with unitTest": {
          "fullName": "custom test functions > works with unitTest",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
      },
    }
  `)
})

test('collects tests with only modifier', async () => {
  const testModule = await collectTests(`
    import { test, testFoo, barTest } from 'vitest'

    describe('only tests', () => {
      test.only('regular test with only', () => {})
      testFoo.only('testFoo with only', () => {})
      barTest.only('barTest with only', () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "only tests": {
        "barTest with only": {
          "fullName": "only tests > barTest with only",
          "id": "-1732721377_0_2",
          "location": {
            "column": 6,
            "line": 7,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "regular test with only": {
          "fullName": "only tests > regular test with only",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "testFoo with only": {
          "fullName": "only tests > testFoo with only",
          "id": "-1732721377_0_1",
          "location": {
            "column": 6,
            "line": 6,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
      },
    }
  `)
})

test('collects tests with skip modifier', async () => {
  const testModule = await collectTests(`
    import { test, testFoo, barTest } from 'vitest'

    describe('skip tests', () => {
      test.skip('regular test with skip', () => {})
      testFoo.skip('testFoo with skip', () => {})
      barTest.skip('barTest with skip', () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "skip tests": {
        "barTest with skip": {
          "fullName": "skip tests > barTest with skip",
          "id": "-1732721377_0_2",
          "location": {
            "column": 6,
            "line": 7,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
        "regular test with skip": {
          "fullName": "skip tests > regular test with skip",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
        "testFoo with skip": {
          "fullName": "skip tests > testFoo with skip",
          "id": "-1732721377_0_1",
          "location": {
            "column": 6,
            "line": 6,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
      },
    }
  `)
})

test('collects tests with todo modifier', async () => {
  const testModule = await collectTests(`
    import { test, testFoo, barTest } from 'vitest'

    describe('todo tests', () => {
      test.todo('regular test with todo', () => {})
      testFoo.todo('testFoo with todo', () => {})
      barTest.todo('barTest with todo', () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "todo tests": {
        "barTest with todo": {
          "fullName": "todo tests > barTest with todo",
          "id": "-1732721377_0_2",
          "location": {
            "column": 6,
            "line": 7,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "todo",
          },
          "result": {
            "state": "skipped",
          },
        },
        "regular test with todo": {
          "fullName": "todo tests > regular test with todo",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "todo",
          },
          "result": {
            "state": "skipped",
          },
        },
        "testFoo with todo": {
          "fullName": "todo tests > testFoo with todo",
          "id": "-1732721377_0_1",
          "location": {
            "column": 6,
            "line": 6,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "todo",
          },
          "result": {
            "state": "skipped",
          },
        },
      },
    }
  `)
})

test('collects nested suites with custom test functions', async () => {
  const testModule = await collectTests(`
    import { test, testUnit, integrationTest } from 'vitest'

    describe('outer suite', () => {
      test('regular test', () => {})

      describe('inner suite', () => {
        testUnit('unit test', () => {})

        describe('deeply nested', () => {
          integrationTest('integration test', () => {})
        })
      })
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "outer suite": {
        "inner suite": {
          "deeply nested": {
            "integration test": {
              "fullName": "outer suite > inner suite > deeply nested > integration test",
              "id": "-1732721377_0_1_1_0",
              "location": {
                "column": 10,
                "line": 11,
                "name": null,
                "source": "simple.test.ts",
              },
              "options": {
                "mode": "run",
              },
              "result": {
                "state": "pending",
              },
            },
          },
          "unit test": {
            "fullName": "outer suite > inner suite > unit test",
            "id": "-1732721377_0_1_0",
            "location": {
              "column": 8,
              "line": 8,
              "name": null,
              "source": "simple.test.ts",
            },
            "options": {
              "mode": "run",
            },
            "result": {
              "state": "pending",
            },
          },
        },
        "regular test": {
          "fullName": "outer suite > regular test",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
      },
    }
  `)
})

test('collects tests from test.extend', async () => {
  const testModule = await collectTests(`
    import { test as base } from 'vitest'

    const test = base.extend({
      fixture: async ({}, use) => {
        await use('value')
      }
    })

    describe('extended tests', () => {
      test('uses extended test', () => {})
      test.skip('skips extended test', () => {})
      test.only('only extended test', () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "extended tests": {
        "only extended test": {
          "fullName": "extended tests > only extended test",
          "id": "-1732721377_0_2",
          "location": {
            "column": 6,
            "line": 13,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "skips extended test": {
          "fullName": "extended tests > skips extended test",
          "id": "-1732721377_0_1",
          "location": {
            "column": 6,
            "line": 12,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
        "uses extended test": {
          "fullName": "extended tests > uses extended test",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 11,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
      },
    }
  `)
})

test('collects tests imported from another file', async () => {
  const testModule = await collectTests(`
    import { myTest } from './my-test'

    describe('imported test function', () => {
      myTest('uses imported test', () => {})
      myTest.skip('skips imported test', () => {})
      myTest.only('only imported test', () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "imported test function": {
        "only imported test": {
          "fullName": "imported test function > only imported test",
          "id": "-1732721377_0_2",
          "location": {
            "column": 6,
            "line": 7,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "skips imported test": {
          "fullName": "imported test function > skips imported test",
          "id": "-1732721377_0_1",
          "location": {
            "column": 6,
            "line": 6,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
        "uses imported test": {
          "fullName": "imported test function > uses imported test",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
      },
    }
  `)
})

test('collects mixed test function names', async () => {
  const testModule = await collectTests(`
    import { it, test, testUnit, integrationTest } from 'vitest'

    describe('mixed tests', () => {
      it('classic it syntax', () => {})
      test('standard test', () => {})
      testUnit('starts with test', () => {})
      integrationTest('ends with Test', () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "mixed tests": {
        "classic it syntax": {
          "fullName": "mixed tests > classic it syntax",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "ends with Test": {
          "fullName": "mixed tests > ends with Test",
          "id": "-1732721377_0_3",
          "location": {
            "column": 6,
            "line": 8,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "standard test": {
          "fullName": "mixed tests > standard test",
          "id": "-1732721377_0_1",
          "location": {
            "column": 6,
            "line": 6,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "starts with test": {
          "fullName": "mixed tests > starts with test",
          "id": "-1732721377_0_2",
          "location": {
            "column": 6,
            "line": 7,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
      },
    }
  `)
})

test('collects tests with all modifiers on custom functions', async () => {
  const testModule = await collectTests(`
    import { testCustom } from './test-helpers'

    describe('custom test with modifiers', () => {
      testCustom('normal custom test', () => {})
      testCustom.skip('skipped custom test', () => {})
      testCustom.only('only custom test', () => {})
      testCustom.todo('todo custom test', () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "custom test with modifiers": {
        "normal custom test": {
          "fullName": "custom test with modifiers > normal custom test",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
        "only custom test": {
          "fullName": "custom test with modifiers > only custom test",
          "id": "-1732721377_0_2",
          "location": {
            "column": 6,
            "line": 7,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "skipped custom test": {
          "fullName": "custom test with modifiers > skipped custom test",
          "id": "-1732721377_0_1",
          "location": {
            "column": 6,
            "line": 6,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
        "todo custom test": {
          "fullName": "custom test with modifiers > todo custom test",
          "id": "-1732721377_0_3",
          "location": {
            "column": 6,
            "line": 8,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "todo",
          },
          "result": {
            "state": "skipped",
          },
        },
      },
    }
  `)
})

test('collects tests in skipped suites', async () => {
  const testModule = await collectTests(`
    import { test, testFoo, barTest } from 'vitest'

    describe.skip('skipped suite', () => {
      test('regular test in skipped suite', () => {})
      testFoo('testFoo in skipped suite', () => {})
      barTest('barTest in skipped suite', () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "skipped suite": {
        "barTest in skipped suite": {
          "fullName": "skipped suite > barTest in skipped suite",
          "id": "-1732721377_0_2",
          "location": {
            "column": 6,
            "line": 7,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
        "regular test in skipped suite": {
          "fullName": "skipped suite > regular test in skipped suite",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
        "testFoo in skipped suite": {
          "fullName": "skipped suite > testFoo in skipped suite",
          "id": "-1732721377_0_1",
          "location": {
            "column": 6,
            "line": 6,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
      },
    }
  `)
})

test('collects tests in only suites', async () => {
  const testModule = await collectTests(`
    import { test, testFoo, barTest } from 'vitest'

    describe.only('only suite', () => {
      test('regular test in only suite', () => {})
      testFoo('testFoo in only suite', () => {})
      barTest('barTest in only suite', () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "only suite": {
        "barTest in only suite": {
          "fullName": "only suite > barTest in only suite",
          "id": "-1732721377_0_2",
          "location": {
            "column": 6,
            "line": 7,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "regular test in only suite": {
          "fullName": "only suite > regular test in only suite",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "testFoo in only suite": {
          "fullName": "only suite > testFoo in only suite",
          "id": "-1732721377_0_1",
          "location": {
            "column": 6,
            "line": 6,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
      },
    }
  `)
})

test('collects tests with each modifier', async () => {
  const testModule = await collectTests(`
    import { test, testFoo, barTest } from 'vitest'

    describe('each tests', () => {
      test.each([1, 2, 3])('test with each %i', (num) => {})
      testFoo.each([1, 2, 3])('testFoo with each %i', (num) => {})
      barTest.each([1, 2, 3])('barTest with each %i', (num) => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "each tests": {
        "barTest with each %i": {
          "dynamic": true,
          "fullName": "each tests > barTest with each %i",
          "id": "-1732721377_0_2-dynamic",
          "location": {
            "column": 28,
            "line": 7,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "test with each %i": {
          "dynamic": true,
          "fullName": "each tests > test with each %i",
          "id": "-1732721377_0_0-dynamic",
          "location": {
            "column": 25,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
        "testFoo with each %i": {
          "dynamic": true,
          "fullName": "each tests > testFoo with each %i",
          "id": "-1732721377_0_1-dynamic",
          "location": {
            "column": 28,
            "line": 6,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "run",
          },
          "result": {
            "state": "pending",
          },
        },
      },
    }
  `)
})

test('collects complex nested structure with custom functions', async () => {
  const testModule = await collectTests(`
    import { test, it, testUnit, integrationTest } from 'vitest'

    describe('root suite', () => {
      test('root test', () => {})

      describe('unit tests', () => {
        testUnit('first unit test', () => {})
        testUnit.skip('skipped unit test', () => {})

        describe.skip('skipped nested', () => {
          testUnit('test in skipped suite', () => {})
        })
      })

      describe.only('integration tests', () => {
        integrationTest('first integration', () => {})
        integrationTest.only('focused integration', () => {})
        integrationTest.todo('planned integration', () => {})
      })
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "root suite": {
        "integration tests": {
          "first integration": {
            "fullName": "root suite > integration tests > first integration",
            "id": "-1732721377_0_2_0",
            "location": {
              "column": 8,
              "line": 17,
              "name": null,
              "source": "simple.test.ts",
            },
            "options": {
              "mode": "run",
            },
            "result": {
              "state": "pending",
            },
          },
          "focused integration": {
            "fullName": "root suite > integration tests > focused integration",
            "id": "-1732721377_0_2_1",
            "location": {
              "column": 8,
              "line": 18,
              "name": null,
              "source": "simple.test.ts",
            },
            "options": {
              "mode": "run",
            },
            "result": {
              "state": "pending",
            },
          },
          "planned integration": {
            "fullName": "root suite > integration tests > planned integration",
            "id": "-1732721377_0_2_2",
            "location": {
              "column": 8,
              "line": 19,
              "name": null,
              "source": "simple.test.ts",
            },
            "options": {
              "mode": "run",
            },
            "result": {
              "state": "pending",
            },
          },
        },
        "root test": {
          "fullName": "root suite > root test",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
        "unit tests": {
          "first unit test": {
            "fullName": "root suite > unit tests > first unit test",
            "id": "-1732721377_0_1_0",
            "location": {
              "column": 8,
              "line": 8,
              "name": null,
              "source": "simple.test.ts",
            },
            "options": {
              "mode": "skip",
            },
            "result": {
              "state": "skipped",
            },
          },
          "skipped nested": {
            "test in skipped suite": {
              "fullName": "root suite > unit tests > skipped nested > test in skipped suite",
              "id": "-1732721377_0_1_2_0",
              "location": {
                "column": 10,
                "line": 12,
                "name": null,
                "source": "simple.test.ts",
              },
              "options": {
                "mode": "skip",
              },
              "result": {
                "state": "skipped",
              },
            },
          },
          "skipped unit test": {
            "fullName": "root suite > unit tests > skipped unit test",
            "id": "-1732721377_0_1_1",
            "location": {
              "column": 8,
              "line": 9,
              "name": null,
              "source": "simple.test.ts",
            },
            "options": {
              "mode": "skip",
            },
            "result": {
              "state": "skipped",
            },
          },
        },
      },
    }
  `)
})

test('collects tests when test functions are globals', async () => {
  const testModule = await collectTests(`
    describe('global test functions', () => {
      test('test as global', () => {})
      it('it as global', () => {})
      testSomething('testSomething as global', () => {})
      myTest('myTest as global', () => {})

      describe('nested', () => {
        test.skip('skipped global test', () => {})
        testUnit.only('testUnit.only as global', () => {})
      })
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "global test functions": {
        "it as global": {
          "fullName": "global test functions > it as global",
          "id": "-1732721377_0_1",
          "location": {
            "column": 6,
            "line": 4,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
        "myTest as global": {
          "fullName": "global test functions > myTest as global",
          "id": "-1732721377_0_3",
          "location": {
            "column": 6,
            "line": 6,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
        "nested": {
          "skipped global test": {
            "fullName": "global test functions > nested > skipped global test",
            "id": "-1732721377_0_4_0",
            "location": {
              "column": 8,
              "line": 9,
              "name": null,
              "source": "simple.test.ts",
            },
            "options": {
              "mode": "skip",
            },
            "result": {
              "state": "skipped",
            },
          },
          "testUnit.only as global": {
            "fullName": "global test functions > nested > testUnit.only as global",
            "id": "-1732721377_0_4_1",
            "location": {
              "column": 8,
              "line": 10,
              "name": null,
              "source": "simple.test.ts",
            },
            "options": {
              "mode": "run",
            },
            "result": {
              "state": "pending",
            },
          },
        },
        "test as global": {
          "fullName": "global test functions > test as global",
          "id": "-1732721377_0_0",
          "location": {
            "column": 6,
            "line": 3,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
        "testSomething as global": {
          "fullName": "global test functions > testSomething as global",
          "id": "-1732721377_0_2",
          "location": {
            "column": 6,
            "line": 5,
            "name": null,
            "source": "simple.test.ts",
          },
          "options": {
            "mode": "skip",
          },
          "result": {
            "state": "skipped",
          },
        },
      },
    }
  `)
})

async function collectTests(code: string, options?: CliOptions) {
  const vitest = await createVitest(
    'test',
    {
      config: false,
      includeTaskLocation: true,
      ...options,
    },
    {
      plugins: [
        {
          name: 'ast-collect-test',
          load(id) {
            if (id === 'simple.test.ts') {
              return code
            }
          },
        },
      ],
    },
  )
  const testModule = await vitest.experimental_parseSpecification(
    vitest.getRootProject().createSpecification('simple.test.ts'),
  )
  return testTree(testModule)
}

function testTree(module: TestModule | TestSuite, tree: any = {}) {
  for (const item of module.children) {
    if (item.type === 'test') {
      tree[item.name] = testItem(item)
    }
    else {
      tree[item.name] ??= {}
      testTree(item, tree[item.name])
    }
  }
  return tree
}

function testItem(testCase: TestCase) {
  return {
    id: testCase.id,
    location: testCase.location,
    options: removeUndefined(testCase.options),
    fullName: testCase.fullName,
    result: removeUndefined(testCase.result()),
    ...(testCase.task.dynamic ? { dynamic: true } : {}),
  }
}

function removeUndefined<T extends Record<string, any>>(obj: T) {
  const newObj = {} as T
  for (const key in obj) {
    if (obj[key] !== undefined) {
      newObj[key] = obj[key]
    }
  }
  return newObj
}
