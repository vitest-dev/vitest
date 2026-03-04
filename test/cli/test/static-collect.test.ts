import type { CliOptions, TestCase, TestModule, TestSuite } from 'vitest/node'
import { runVitest } from '#test-utils'
import { resolve } from 'pathe'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest, rolldownVersion } from 'vitest/node'

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
          "errors": [],
          "fullName": "math operations > adds numbers",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "run",
          "state": "pending",
        },
        "subtracts numbers": {
          "errors": [],
          "fullName": "math operations > subtracts numbers",
          "id": "-1732721377_0_1",
          "location": "9:6",
          "mode": "skip",
          "state": "skipped",
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
          "errors": [],
          "fullName": "custom test functions > works with testAnother",
          "id": "-1732721377_0_1",
          "location": "6:6",
          "mode": "run",
          "state": "pending",
        },
        "works with testSomething": {
          "errors": [],
          "fullName": "custom test functions > works with testSomething",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "run",
          "state": "pending",
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
          "errors": [],
          "fullName": "custom test functions > works with integrationTest",
          "id": "-1732721377_0_1",
          "location": "6:6",
          "mode": "run",
          "state": "pending",
        },
        "works with unitTest": {
          "errors": [],
          "fullName": "custom test functions > works with unitTest",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "run",
          "state": "pending",
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
          "errors": [],
          "fullName": "only tests > barTest with only",
          "id": "-1732721377_0_2",
          "location": "7:6",
          "mode": "run",
          "state": "pending",
        },
        "regular test with only": {
          "errors": [],
          "fullName": "only tests > regular test with only",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "run",
          "state": "pending",
        },
        "testFoo with only": {
          "errors": [],
          "fullName": "only tests > testFoo with only",
          "id": "-1732721377_0_1",
          "location": "6:6",
          "mode": "run",
          "state": "pending",
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
          "errors": [],
          "fullName": "skip tests > barTest with skip",
          "id": "-1732721377_0_2",
          "location": "7:6",
          "mode": "skip",
          "state": "skipped",
        },
        "regular test with skip": {
          "errors": [],
          "fullName": "skip tests > regular test with skip",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "skip",
          "state": "skipped",
        },
        "testFoo with skip": {
          "errors": [],
          "fullName": "skip tests > testFoo with skip",
          "id": "-1732721377_0_1",
          "location": "6:6",
          "mode": "skip",
          "state": "skipped",
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
          "errors": [],
          "fullName": "todo tests > barTest with todo",
          "id": "-1732721377_0_2",
          "location": "7:6",
          "mode": "todo",
          "state": "skipped",
        },
        "regular test with todo": {
          "errors": [],
          "fullName": "todo tests > regular test with todo",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "todo",
          "state": "skipped",
        },
        "testFoo with todo": {
          "errors": [],
          "fullName": "todo tests > testFoo with todo",
          "id": "-1732721377_0_1",
          "location": "6:6",
          "mode": "todo",
          "state": "skipped",
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
              "errors": [],
              "fullName": "outer suite > inner suite > deeply nested > integration test",
              "id": "-1732721377_0_1_1_0",
              "location": "11:10",
              "mode": "run",
              "state": "pending",
            },
          },
          "unit test": {
            "errors": [],
            "fullName": "outer suite > inner suite > unit test",
            "id": "-1732721377_0_1_0",
            "location": "8:8",
            "mode": "run",
            "state": "pending",
          },
        },
        "regular test": {
          "errors": [],
          "fullName": "outer suite > regular test",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "run",
          "state": "pending",
        },
      },
    }
  `)
})

test('ignores test.scoped and test.override', async () => {
  const testModule = await collectTests(`
    import { test as base } from 'vitest'

    const test = base.extend({
      fixture: async ({}, use) => {
        await use('value')
      },
    })

    test.scoped({ fixture: 'value' })
    test.override({ fixture: 'value' })

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
          "errors": [],
          "fullName": "extended tests > only extended test",
          "id": "-1732721377_0_2",
          "location": "16:6",
          "mode": "run",
          "state": "pending",
        },
        "skips extended test": {
          "errors": [],
          "fullName": "extended tests > skips extended test",
          "id": "-1732721377_0_1",
          "location": "15:6",
          "mode": "skip",
          "state": "skipped",
        },
        "uses extended test": {
          "errors": [],
          "fullName": "extended tests > uses extended test",
          "id": "-1732721377_0_0",
          "location": "14:6",
          "mode": "skip",
          "state": "skipped",
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
          "errors": [],
          "fullName": "extended tests > only extended test",
          "id": "-1732721377_0_2",
          "location": "13:6",
          "mode": "run",
          "state": "pending",
        },
        "skips extended test": {
          "errors": [],
          "fullName": "extended tests > skips extended test",
          "id": "-1732721377_0_1",
          "location": "12:6",
          "mode": "skip",
          "state": "skipped",
        },
        "uses extended test": {
          "errors": [],
          "fullName": "extended tests > uses extended test",
          "id": "-1732721377_0_0",
          "location": "11:6",
          "mode": "skip",
          "state": "skipped",
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
          "errors": [],
          "fullName": "imported test function > only imported test",
          "id": "-1732721377_0_2",
          "location": "7:6",
          "mode": "run",
          "state": "pending",
        },
        "skips imported test": {
          "errors": [],
          "fullName": "imported test function > skips imported test",
          "id": "-1732721377_0_1",
          "location": "6:6",
          "mode": "skip",
          "state": "skipped",
        },
        "uses imported test": {
          "errors": [],
          "fullName": "imported test function > uses imported test",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "skip",
          "state": "skipped",
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
          "errors": [],
          "fullName": "mixed tests > classic it syntax",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "run",
          "state": "pending",
        },
        "ends with Test": {
          "errors": [],
          "fullName": "mixed tests > ends with Test",
          "id": "-1732721377_0_3",
          "location": "8:6",
          "mode": "run",
          "state": "pending",
        },
        "standard test": {
          "errors": [],
          "fullName": "mixed tests > standard test",
          "id": "-1732721377_0_1",
          "location": "6:6",
          "mode": "run",
          "state": "pending",
        },
        "starts with test": {
          "errors": [],
          "fullName": "mixed tests > starts with test",
          "id": "-1732721377_0_2",
          "location": "7:6",
          "mode": "run",
          "state": "pending",
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
          "errors": [],
          "fullName": "custom test with modifiers > normal custom test",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "skip",
          "state": "skipped",
        },
        "only custom test": {
          "errors": [],
          "fullName": "custom test with modifiers > only custom test",
          "id": "-1732721377_0_2",
          "location": "7:6",
          "mode": "run",
          "state": "pending",
        },
        "skipped custom test": {
          "errors": [],
          "fullName": "custom test with modifiers > skipped custom test",
          "id": "-1732721377_0_1",
          "location": "6:6",
          "mode": "skip",
          "state": "skipped",
        },
        "todo custom test": {
          "errors": [],
          "fullName": "custom test with modifiers > todo custom test",
          "id": "-1732721377_0_3",
          "location": "8:6",
          "mode": "todo",
          "state": "skipped",
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
          "errors": [],
          "fullName": "skipped suite > barTest in skipped suite",
          "id": "-1732721377_0_2",
          "location": "7:6",
          "mode": "skip",
          "state": "skipped",
        },
        "regular test in skipped suite": {
          "errors": [],
          "fullName": "skipped suite > regular test in skipped suite",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "skip",
          "state": "skipped",
        },
        "testFoo in skipped suite": {
          "errors": [],
          "fullName": "skipped suite > testFoo in skipped suite",
          "id": "-1732721377_0_1",
          "location": "6:6",
          "mode": "skip",
          "state": "skipped",
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
          "errors": [],
          "fullName": "only suite > barTest in only suite",
          "id": "-1732721377_0_2",
          "location": "7:6",
          "mode": "run",
          "state": "pending",
        },
        "regular test in only suite": {
          "errors": [],
          "fullName": "only suite > regular test in only suite",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "run",
          "state": "pending",
        },
        "testFoo in only suite": {
          "errors": [],
          "fullName": "only suite > testFoo in only suite",
          "id": "-1732721377_0_1",
          "location": "6:6",
          "mode": "run",
          "state": "pending",
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
          "each": true,
          "errors": [],
          "fullName": "each tests > barTest with each %i",
          "id": "-1732721377_0_2-dynamic",
          "location": "7:28",
          "mode": "run",
          "state": "pending",
        },
        "test with each %i": {
          "dynamic": true,
          "each": true,
          "errors": [],
          "fullName": "each tests > test with each %i",
          "id": "-1732721377_0_0-dynamic",
          "location": "5:25",
          "mode": "run",
          "state": "pending",
        },
        "testFoo with each %i": {
          "dynamic": true,
          "each": true,
          "errors": [],
          "fullName": "each tests > testFoo with each %i",
          "id": "-1732721377_0_1-dynamic",
          "location": "6:28",
          "mode": "run",
          "state": "pending",
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
            "errors": [],
            "fullName": "root suite > integration tests > first integration",
            "id": "-1732721377_0_2_0",
            "location": "17:8",
            "mode": "run",
            "state": "pending",
          },
          "focused integration": {
            "errors": [],
            "fullName": "root suite > integration tests > focused integration",
            "id": "-1732721377_0_2_1",
            "location": "18:8",
            "mode": "run",
            "state": "pending",
          },
          "planned integration": {
            "errors": [],
            "fullName": "root suite > integration tests > planned integration",
            "id": "-1732721377_0_2_2",
            "location": "19:8",
            "mode": "run",
            "state": "pending",
          },
        },
        "root test": {
          "errors": [],
          "fullName": "root suite > root test",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "skip",
          "state": "skipped",
        },
        "unit tests": {
          "first unit test": {
            "errors": [],
            "fullName": "root suite > unit tests > first unit test",
            "id": "-1732721377_0_1_0",
            "location": "8:8",
            "mode": "skip",
            "state": "skipped",
          },
          "skipped nested": {
            "test in skipped suite": {
              "errors": [],
              "fullName": "root suite > unit tests > skipped nested > test in skipped suite",
              "id": "-1732721377_0_1_2_0",
              "location": "12:10",
              "mode": "skip",
              "state": "skipped",
            },
          },
          "skipped unit test": {
            "errors": [],
            "fullName": "root suite > unit tests > skipped unit test",
            "id": "-1732721377_0_1_1",
            "location": "9:8",
            "mode": "skip",
            "state": "skipped",
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
          "errors": [],
          "fullName": "global test functions > it as global",
          "id": "-1732721377_0_1",
          "location": "4:6",
          "mode": "skip",
          "state": "skipped",
        },
        "myTest as global": {
          "errors": [],
          "fullName": "global test functions > myTest as global",
          "id": "-1732721377_0_3",
          "location": "6:6",
          "mode": "skip",
          "state": "skipped",
        },
        "nested": {
          "skipped global test": {
            "errors": [],
            "fullName": "global test functions > nested > skipped global test",
            "id": "-1732721377_0_4_0",
            "location": "9:8",
            "mode": "skip",
            "state": "skipped",
          },
          "testUnit.only as global": {
            "errors": [],
            "fullName": "global test functions > nested > testUnit.only as global",
            "id": "-1732721377_0_4_1",
            "location": "10:8",
            "mode": "run",
            "state": "pending",
          },
        },
        "test as global": {
          "errors": [],
          "fullName": "global test functions > test as global",
          "id": "-1732721377_0_0",
          "location": "3:6",
          "mode": "skip",
          "state": "skipped",
        },
        "testSomething as global": {
          "errors": [],
          "fullName": "global test functions > testSomething as global",
          "id": "-1732721377_0_2",
          "location": "5:6",
          "mode": "skip",
          "state": "skipped",
        },
      },
    }
  `)
})

test('remove .name from the function identifiers', async () => {
  const testModule = await collectTests(`
    import { test } from 'vitest'

    test(Service.name, () => {
      // ...
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "Service": {
        "errors": [],
        "fullName": "Service",
        "id": "-1732721377_0",
        "location": "4:4",
        "mode": "run",
        "state": "pending",
      },
    }
  `)
})

test('collects tests with tags as a string', async () => {
  const testModule = await collectTests(`
    import { test } from 'vitest'

    describe('tagged tests', () => {
      test('test with single tag', { tags: 'slow' }, () => {})
      test('test without tags', () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "tagged tests": {
        "test with single tag": {
          "errors": [],
          "fullName": "tagged tests > test with single tag",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "run",
          "state": "pending",
          "tags": [
            "slow",
          ],
        },
        "test without tags": {
          "errors": [],
          "fullName": "tagged tests > test without tags",
          "id": "-1732721377_0_1",
          "location": "6:6",
          "mode": "run",
          "state": "pending",
        },
      },
    }
  `)
})

test('collects tests with tags as an array', async () => {
  const testModule = await collectTests(`
    import { test } from 'vitest'

    describe('tagged tests', () => {
      test('test with multiple tags', { tags: ['slow', 'integration'] }, () => {})
      test('test with empty tags', { tags: [] }, () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "tagged tests": {
        "test with empty tags": {
          "errors": [],
          "fullName": "tagged tests > test with empty tags",
          "id": "-1732721377_0_1",
          "location": "6:6",
          "mode": "run",
          "state": "pending",
        },
        "test with multiple tags": {
          "errors": [],
          "fullName": "tagged tests > test with multiple tags",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "run",
          "state": "pending",
          "tags": [
            "slow",
            "integration",
          ],
        },
      },
    }
  `)
})

test('collects suites with tags', async () => {
  const testModule = await collectTests(`
    import { test, describe } from 'vitest'

    describe('tagged suite', { tags: ['unit'] }, () => {
      test('test in tagged suite', () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "tagged suite": {
        "test in tagged suite": {
          "errors": [],
          "fullName": "tagged suite > test in tagged suite",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "run",
          "state": "pending",
          "tags": [
            "unit",
          ],
        },
      },
    }
  `)
})

test('inherits tags from parent suites', async () => {
  const testModule = await collectTests(`
    import { test, describe } from 'vitest'

    describe('outer suite', { tags: ['slow'] }, () => {
      test('test inherits parent tag', () => {})

      describe('inner suite', { tags: ['integration'] }, () => {
        test('test inherits both tags', () => {})
        test('test with own tag', { tags: ['unit'] }, () => {})
      })
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "outer suite": {
        "inner suite": {
          "test inherits both tags": {
            "errors": [],
            "fullName": "outer suite > inner suite > test inherits both tags",
            "id": "-1732721377_0_1_0",
            "location": "8:8",
            "mode": "run",
            "state": "pending",
            "tags": [
              "slow",
              "integration",
            ],
          },
          "test with own tag": {
            "errors": [],
            "fullName": "outer suite > inner suite > test with own tag",
            "id": "-1732721377_0_1_1",
            "location": "9:8",
            "mode": "run",
            "state": "pending",
            "tags": [
              "slow",
              "integration",
              "unit",
            ],
          },
        },
        "test inherits parent tag": {
          "errors": [],
          "fullName": "outer suite > test inherits parent tag",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "run",
          "state": "pending",
          "tags": [
            "slow",
          ],
        },
      },
    }
  `)
})

test('collects tags with other options', async () => {
  const testModule = await collectTests(`
    import { test } from 'vitest'

    describe('tests with options', () => {
      test('test with tags and timeout', { tags: ['slow'], timeout: 5000 }, () => {})
      test.skip('skipped test with tags', { tags: ['unit'] }, () => {})
    })
`)
  expect(testModule).toMatchInlineSnapshot(`
    {
      "tests with options": {
        "skipped test with tags": {
          "errors": [],
          "fullName": "tests with options > skipped test with tags",
          "id": "-1732721377_0_1",
          "location": "6:6",
          "mode": "skip",
          "state": "skipped",
          "tags": [
            "unit",
          ],
        },
        "test with tags and timeout": {
          "errors": [],
          "fullName": "tests with options > test with tags and timeout",
          "id": "-1732721377_0_0",
          "location": "5:6",
          "mode": "run",
          "state": "pending",
          "tags": [
            "slow",
          ],
        },
      },
    }
  `)
})

test('reports error when using undefined tag', async () => {
  const testModule = await collectTestModule(`
    import { test } from 'vitest'

    describe('tests with undefined tag', () => {
      test('test with undefined tag', { tags: ['undefined-tag'] }, () => {})
    })
`)
  expect(testModule.errors()[0].message).toMatchInlineSnapshot(`
    "The tag "undefined-tag" is not defined in the configuration. Available tags are:
    - slow
    - integration
    - unit"
  `)
})

test('@module-tag docs inject test tags', async () => {
  const { ctx } = await runVitest({
    config: false,
    root: './fixtures/file-tags',
    standalone: true,
    watch: true,
    tags: [
      { name: 'file' },
      { name: 'file-2' },
      { name: 'file/slash' },
      { name: 'test' },
    ],
  })
  const testModule = await ctx!.experimental_parseSpecification(
    ctx!.getRootProject().createSpecification(resolve(ctx!.config.root, './valid-file-tags.test.ts')),
  )
  expect(testTree(testModule)).toMatchInlineSnapshot(`
    {
      "suite 1": {
        "test 1": {
          "errors": [],
          "fullName": "suite 1 > test 1",
          "id": "492646822_0_0",
          "location": "10:2",
          "mode": "run",
          "state": "pending",
          "tags": [
            "file",
            "file-2",
            "file/slash",
            "test",
          ],
        },
      },
    }
  `)
})

test('invalid @module-tag throws and error', async () => {
  const { ctx } = await runVitest({
    config: false,
    root: './fixtures/file-tags',
    include: ['./error-file-tags.test.ts'],
    tags: [
      { name: 'file' },
      { name: 'file-2' },
      { name: 'file/slash' },
      { name: 'test' },
    ],
  })
  const testModule = await ctx!.experimental_parseSpecification(
    ctx!.getRootProject().createSpecification(resolve(ctx!.config.root, './error-file-tags.test.ts')),
  )
  expect(testModule.errors()[0].message).toMatchInlineSnapshot(`
    "The tag "invalid" is not defined in the configuration. Available tags are:
    - file
    - file-2
    - file/slash
    - test"
  `)
})

async function collectTestModule(code: string, options?: CliOptions) {
  const vitest = await createVitest(
    'test',
    {
      config: false,
      includeTaskLocation: true,
      allowOnly: true,
      ...options,
      tags: [
        { name: 'slow' },
        { name: 'integration' },
        { name: 'unit' },
      ],
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
  onTestFinished(() => vitest.close())
  return vitest.experimental_parseSpecification(
    vitest.getRootProject().createSpecification('simple.test.ts'),
  )
}

async function collectTests(code: string, options?: CliOptions) {
  return testTree(await collectTestModule(code, options))
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
  let location: string | undefined
  if (testCase.location) {
    // rolldown's column is moved by 1 when using test.each/test.for
    const column = rolldownVersion && testCase.options.each
      ? testCase.location.column - 1
      : testCase.location.column
    location = `${testCase.location.line}:${column}`
  }
  return {
    id: testCase.id,
    location,
    mode: testCase.options.mode,
    fullName: testCase.fullName,
    state: testCase.result().state,
    errors: testCase.result().errors || [],
    ...(testCase.task.dynamic ? { dynamic: true } : {}),
    ...(testCase.options.each ? { each: true } : {}),
    ...(testCase.task.tags?.length ? { tags: testCase.task.tags } : {}),
  }
}
