import type { afterAll, beforeAll, ExpectStatic, expectTypeOf as ExpectTypeOfFn, SuiteAPI, TestAPI } from 'vitest'
import type { ViteUserConfig } from 'vitest/config'
import type { TestSpecification, TestUserConfig } from 'vitest/node'
import type { TestFsStructure } from '../../test-utils'
import { playwright } from '@vitest/browser-playwright'
import { beforeEach, describe, expect, test } from 'vitest'
import { rolldownVersion } from 'vitest/node'
import { replaceRoot, runInlineTests, stripIndent } from '../../test-utils'

// "it" is used inside subtests, we can't "import" it because vitest will inject __vite_ssr_import__
declare const it: TestAPI

if (rolldownVersion) {
  beforeEach(({ skip }) => {
    // TODO: remove skip when we only test against rolldown
    // oxc has a dofferent output of inlined functions in "runInlineTests"
    // it keeps comments and formats the output
    skip()
  })
}

test('test fixture cannot import from file fixture', async () => {
  const { stderr } = await runInlineTests({
    'basic.test.ts': () => {
      const extendedTest = it.extend<{
        file: string
        local: string
      }>({
        local: ({}, use) => use('local'),
        file: [({ local }, use) => use(local), { scope: 'file' }],
      })

      extendedTest('not working', ({ file: _file }) => {})
    },
  }, { globals: true })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts [ basic.test.ts ]
    FixtureDependencyError: The file "file" fixture cannot depend on a test fixture "local".
     ❯ basic.test.ts:2:27
          1| await (() => {
          2|   const extendedTest = it.extend({
           |                           ^
          3|     local: ({}, use) => use("local"),
          4|     file: [({ local }, use) => use(local), { scope: "file" }]
     ❯ basic.test.ts:8:1

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('can import file fixture inside the local fixture', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => it.extend<{
    file: string
    local: string
  }>({
    local: async ({ file }, use) => {
      log('init local')
      await use(file)
      log('teardown local')
    },
    file: [
      async ({}, use) => {
        log('init file')
        await use('file')
        log('teardown file')
      },
      { scope: 'file' },
    ],
  }), {
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest('test1', ({ local: _local }) => {})
    },
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | init file | test1
    >> fixture | init local | test1
    >> fixture | teardown local | test1
    >> fixture | teardown file | test1"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > test1 <time>"`)
})

test('can import worker fixture inside the local fixture', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => it.extend<{
    worker: string
    local: string
  }>({
    local: async ({ worker }, use) => {
      log('init local')
      await use(worker)
      log('teardown local')
    },
    worker: [
      async ({}, use) => {
        log('init worker')
        await use('worker')
        log('teardown worker')
      },
      { scope: 'worker' },
    ],
  }), {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('test1', ({ local }) => {
        expect(local).toBe('worker')
      })
    },
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | init worker | test1
    >> fixture | init local | test1
    >> fixture | teardown local | test1
    >> fixture | teardown worker | test1"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > test1 <time>"`)
})

test('test fixture cannot import from worker fixture', async () => {
  const { stderr } = await runInlineTests({
    'basic.test.ts': () => {
      const extendedTest = it.extend<{
        worker: string
        local: string
      }>({
        local: ({}, use) => use('local'),
        worker: [
          ({ local }, use) => use(local),
          { scope: 'worker' },
        ],
      })

      extendedTest('not working', ({ worker: _worker }) => {})
    },
  }, { globals: true })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts [ basic.test.ts ]
    FixtureDependencyError: The worker "worker" fixture cannot depend on a test fixture "local".
     ❯ basic.test.ts:2:27
          1| await (() => {
          2|   const extendedTest = it.extend({
           |                           ^
          3|     local: ({}, use) => use("local"),
          4|     worker: [
     ❯ basic.test.ts:11:1

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('auto worker fixture is initialised always before the first test', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => it.extend<{ worker: string }>({
    worker: [
      async ({}, use) => {
        log('init file')
        await use('worker')
        log('teardown file')
      },
      { scope: 'worker', auto: true },
    ],
  }), {
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest('test1', ({}) => {})
      extendedTest('test2', ({}) => {})
      extendedTest('test3', ({ worker: _worker }) => {})
      extendedTest('test4', ({}) => {})
    },
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | init file | test1
    >> fixture | teardown file | test4"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ basic.test.ts > test1 <time>
     ✓ basic.test.ts > test2 <time>
     ✓ basic.test.ts > test3 <time>
     ✓ basic.test.ts > test4 <time>"
  `)
})

test('worker fixture can import a static value from test fixture', async () => {
  const { stderr } = await runFixtureTests(() => it.extend<{
    worker: string
    local: string
  }>({
    local: 'local',
    worker: [
      ({ local }, use) => use(local),
      { scope: 'worker' },
    ],
  }), {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('working', ({ worker, local }) => {
        expect(worker).toBe(local)
        expect(worker).toBe('local')
      })
    },
  }, { globals: true })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts [ basic.test.ts ]
    FixtureDependencyError: The worker "worker" fixture cannot depend on a test fixture "local".
     ❯ test.js:5:39
          3| export const expect = globalThis.expect
          4| export const expectTypeOf = globalThis.expectTypeOf
          5| export const extendedTest = (() => it.extend({
           |                                       ^
          6|   local: "local",
          7|   worker: [
     ❯ test.js:11:4

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('file fixture cannot import a static value from test fixture', async () => {
  const { stderr } = await runFixtureTests(() => it.extend<{
    file: string
    local: string
  }>({
    local: 'local',
    file: [
      ({ local }, use) => use(local),
      { scope: 'file' },
    ],
  }), {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('working', ({ file, local }) => {
        expect(file).toBe(local)
        expect(file).toBe('local')
      })
    },
  }, { globals: true })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts [ basic.test.ts ]
    FixtureDependencyError: The file "file" fixture cannot depend on a test fixture "local".
     ❯ test.js:5:39
          3| export const expect = globalThis.expect
          4| export const expectTypeOf = globalThis.expectTypeOf
          5| export const extendedTest = (() => it.extend({
           |                                       ^
          6|   local: "local",
          7|   file: [
     ❯ test.js:11:4

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('worker fixture works in vmThreads and runs for every file', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => it.extend<{ worker: string }>({
    worker: [
      async ({}, use) => {
        log('init worker')
        await use('worker')
        log('teardown worker')
      },
      { scope: 'worker' },
    ],
  }), {
    '1-basic.test.ts': ({ extendedTest }) => {
      extendedTest('test1', ({ worker: _worker }) => {})
    },
    '2-basic.test.ts': ({ extendedTest }) => {
      extendedTest('test1', ({ worker: _worker }) => {})
    },
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | init worker | test1
    >> fixture | teardown worker | test1
    >> fixture | init worker | test1
    >> fixture | teardown worker | test1"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ 1-basic.test.ts > test1 <time>
     ✓ 2-basic.test.ts > test1 <time>"
  `)
})

test('worker fixtures in isolated tests init and teardown twice', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => it.extend<{ worker: string }>({
    worker: [
      async ({}, use) => {
        log('init worker')
        await use('worker')
        log('teardown worker')
      },
      { scope: 'worker' },
    ],
  }), {
    '1-basic.test.ts': ({ extendedTest }) => {
      extendedTest('test1', ({ worker: _worker }) => {})
    },
    '2-basic.test.ts': ({ extendedTest }) => {
      extendedTest('test2', ({ worker: _worker }) => {})
    },
  }, {
    globals: true,
    maxWorkers: 1,
    pool: 'vmThreads',
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | init worker | test1
    >> fixture | teardown worker | test1
    >> fixture | init worker | test2
    >> fixture | teardown worker | test2"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ 1-basic.test.ts > test1 <time>
     ✓ 2-basic.test.ts > test2 <time>"
  `)
})

test('worker fixture initiates and torn down in different workers', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => it.extend<{ worker: string }>({
    worker: [
      async ({}, use) => {
        log('init worker')
        await use('worker')
        log('teardown worker')
      },
      { scope: 'worker' },
    ],
  }), {
    '1-basic.test.ts': ({ extendedTest }) => {
      extendedTest('test1', ({ worker: _worker }) => {})
    },
    '2-basic.test.ts': ({ extendedTest }) => {
      extendedTest('test2', ({ worker: _worker }) => {})
    },
  }, {
    globals: true,
    isolate: false,
    maxWorkers: 2,
    pool: 'threads',
  })

  expect(stderr).toBe('')

  // tests run in parallel so we can't guarantee the order
  expect(fixtures).toContain(`>> fixture | init worker | test1`)
  expect(fixtures).toContain(`>> fixture | teardown worker | test1`)

  expect(fixtures).toContain(`>> fixture | init worker | test2`)
  expect(fixtures).toContain(`>> fixture | teardown worker | test2`)

  expect(tests).toContain(' ✓ 1-basic.test.ts > test1 <time>')
  expect(tests).toContain(' ✓ 2-basic.test.ts > test2 <time>')
})

test('worker fixture initiates and torn down in one non-isolated worker', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => it.extend<{ worker: string }>({
    worker: [
      async ({}, use) => {
        log('init worker')
        await use('worker')
        log('teardown worker')
      },
      { scope: 'worker' },
    ],
  }), {
    '1-basic.test.ts': ({ extendedTest }) => {
      extendedTest('test1', ({ worker: _worker }) => {})
    },
    '2-basic.test.ts': ({ extendedTest }) => {
      extendedTest('test1', ({ worker: _worker }) => {})
    },
  }, {
    globals: true,
    isolate: false,
    maxWorkers: 1,
    pool: 'threads',
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | init worker | test1
    >> fixture | teardown worker | test1"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ 1-basic.test.ts > test1 <time>
     ✓ 2-basic.test.ts > test1 <time>"
  `)
})

test('worker fixtures are available in beforeEach and afterEach', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => it.extend<{ worker: string }>({
    worker: [
      async ({}, use) => {
        log('init worker')
        await use('worker')
        log('teardown worker')
      },
      { scope: 'worker' },
    ],
  }), {
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest.beforeEach(({ worker }) => {
        console.log('>> fixture | beforeEach |', worker)
      })
      extendedTest.afterEach(({ worker }) => {
        console.log('>> fixture | afterEach |', worker)
      })
      extendedTest('test1', ({}) => {})
      extendedTest('test2', ({}) => {})
    },
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | init worker | test1
    >> fixture | beforeEach | worker
    >> fixture | afterEach | worker
    >> fixture | beforeEach | worker
    >> fixture | afterEach | worker
    >> fixture | teardown worker | test2"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ basic.test.ts > test1 <time>
     ✓ basic.test.ts > test2 <time>"
  `)
})

test('file fixtures are available in beforeEach and afterEach', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => it.extend<{
    file: string
  }>({
    file: [
      async ({}, use) => {
        log('init file')
        await use('file')
        log('teardown file')
      },
      { scope: 'file' },
    ],
  }), {
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest.beforeEach(({ file }) => {
        console.log('>> fixture | beforeEach |', file)
      })
      extendedTest.afterEach(({ file }) => {
        console.log('>> fixture | afterEach |', file)
      })
      extendedTest('test1', ({}) => {})
      extendedTest('test2', ({}) => {})
    },
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | init file | test1
    >> fixture | beforeEach | file
    >> fixture | afterEach | file
    >> fixture | beforeEach | file
    >> fixture | afterEach | file
    >> fixture | teardown file | test2"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ basic.test.ts > test1 <time>
     ✓ basic.test.ts > test2 <time>"
  `)
})

test('cannot access test level fixtures in aroundAll hook', async () => {
  const { stderr } = await runFixtureTests(() => {
    return it.extend('value', 'extended-value')
  }, {
    'basic.test.ts': ({ extendedTest }) => {
      // @ts-expect-error value is a test fixture
      extendedTest.aroundAll(async (runSuite, { value }) => {
        console.log('>> fixture | aroundAll - setup |', value)
        await runSuite()
        console.log('>> fixture | aroundAll - teardown |', value)
      })
      extendedTest('test1', ({}) => {})
    },
  })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts [ basic.test.ts ]
    FixtureDependencyError: Test-scoped fixtures cannot be used inside aroundAll hook. The following fixtures are test-scoped: "value". Use { scope: 'file' } or { scope: 'worker' } fixtures instead, or move the logic to aroundEach hook.
     ❯ basic.test.ts:4:16
          2| import { extendedTest, expect, expectTypeOf, describe, beforeAll, afte…
          3| const results = await (({ extendedTest }) => {
          4|   extendedTest.aroundAll(async (runSuite, { value }) => {
           |                ^
          5|     console.log(">> fixture | aroundAll - setup |", value);
          6|     await runSuite();
     ❯ basic.test.ts:11:1

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('extend fixtures are available in beforeAll and afterAll', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(() => {
    return it.extend('value', { scope: 'file' }, 'extended-value')
  }, {
    'basic.test.ts': ({ extendedTest }) => {
      // No need for override - extended fixtures should be available in hooks
      extendedTest.beforeAll(({ value }) => {
        console.log('>> fixture | beforeAll |', value)
      })
      extendedTest.afterAll(({ value }) => {
        console.log('>> fixture | afterAll |', value)
      })
      extendedTest('test1', ({}) => {})
      extendedTest('test2', ({}) => {})
    },
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | beforeAll | extended-value
    >> fixture | afterAll | extended-value"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ basic.test.ts > test1 <time>
     ✓ basic.test.ts > test2 <time>"
  `)
})

test('extend fixtures are available in aroundAll', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(() => {
    return it.extend('value', { scope: 'file' }, 'extended-value')
  }, {
    'basic.test.ts': ({ extendedTest }) => {
      // No need for override - extended fixtures should be available in hooks
      extendedTest.aroundAll(async (runSuite, { value }) => {
        console.log('>> fixture | aroundAll before |', value)
        await runSuite()
        console.log('>> fixture | aroundAll after |', value)
      })
      extendedTest('test1', ({}) => {})
      extendedTest('test2', ({}) => {})
    },
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | aroundAll before | extended-value
    >> fixture | aroundAll after | extended-value"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ basic.test.ts > test1 <time>
     ✓ basic.test.ts > test2 <time>"
  `)
})

test('beforeAll/afterAll hooks receive file/worker fixtures, not test fixtures', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => {
    return it
      .extend('staticValue', 'static-value')
      .extend('fileValue', { scope: 'file' }, () => {
        log('fileValue setup')
        return 'file-scoped'
      })
      .extend('testValue', () => {
        log('testValue setup')
        return 'test-scoped'
      })
  }, {
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest.beforeAll(({ fileValue }) => {
        // staticValue and fileValue should be available
        console.log('>> fixture | beforeAll | file:', fileValue)
      })
      extendedTest.afterAll(({ fileValue }) => {
        console.log('>> fixture | afterAll | file:', fileValue)
      })
      extendedTest('test1', ({ fileValue, staticValue, testValue }) => {
        console.log('>> fixture | test | static:', staticValue, 'file:', fileValue, 'test:', testValue)
      })
    },
  })

  expect(stderr).toBe('')
  // Static and file fixtures are available in hooks
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | fileValue setup | undefined
    >> fixture | beforeAll | file: file-scoped
    >> fixture | testValue setup | test1
    >> fixture | test | static: static-value file: file-scoped test: test-scoped
    >> fixture | afterAll | file: file-scoped"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > test1 <time>"`)
})

test('beforeAll/afterAll hooks throw error when accessing test-scoped fixtures', async () => {
  const { stderr } = await runFixtureTests(({ log }) => {
    return it
      .extend('fileValue', { scope: 'file' }, () => {
        log('fileValue setup')
        return 'file-scoped'
      })
      .extend('testValue', () => {
        log('testValue setup')
        return 'test-scoped'
      })
  }, {
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest.beforeAll(({
        fileValue: _fileValue,
        // @ts-expect-error - test-scoped fixtures are not available in beforeAll
        testValue: _testValue,
      }) => {})
      extendedTest('test1', ({}) => {})
    },
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts [ basic.test.ts ]
    FixtureDependencyError: Test-scoped fixtures cannot be used inside beforeAll hook. The following fixtures are test-scoped: "testValue". Use { scope: 'file' } or { scope: 'worker' } fixtures instead, or move the logic to beforeEach hook.
     ❯ basic.test.ts:4:16
          2| import { extendedTest, expect, expectTypeOf, describe, beforeAll, afte…
          3| const results = await (({ extendedTest }) => {
          4|   extendedTest.beforeAll(({
           |                ^
          5|     fileValue: _fileValue,
          6|     // @ts-expect-error - test-scoped fixtures are not available in be…
     ❯ basic.test.ts:12:1

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('global beforeAll/afterAll hooks throw error when accessing any fixture', async () => {
  const { stderr, fixtures, fs } = await runFixtureTests(({ log }) => {
    return it
      .extend('fileValue', { scope: 'file' }, () => {
        log('fileValue setup')
        return 'file-scoped'
      })
  }, {
    'basic.test.ts': ({ extendedTest, beforeAll }) => {
      beforeAll<{ fileValue: string }>(({
        fileValue,
      }) => {
        console.log('>> fixture | beforeAll | file:', fileValue)
      })
      extendedTest('test1', ({}) => {})
    },
  })

  expect(fixtures).toMatchInlineSnapshot(`">> fixture | beforeAll | file: undefined"`)
  expect(replaceRoot(stderr, fs.root)).toMatchInlineSnapshot(`
    "stderr | basic.test.ts
    The beforeAll hook uses fixtures "fileValue", but has no access to context. Did you forget to call it as "test.beforeAll()" instead of "beforeAll()"? This will throw an error in a future major. See https://vitest.dev/guide/test-context#suite-level-hooks
        at <root>/basic.test.ts:4:3
        at <root>/basic.test.ts:11:1

    "
  `)
})

test('aroundAll hooks receive file/worker fixtures, not test fixtures', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => {
    return it
      .extend('staticValue', 'static-value')
      .extend('workerValue', { scope: 'worker' }, () => {
        log('workerValue setup')
        return 'worker-scoped'
      })
      .extend('testValue', () => {
        log('testValue setup')
        return 'test-scoped'
      })
  }, {
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest.aroundAll(async (runSuite, { workerValue }) => {
        // staticValue and workerValue should be available
        console.log('>> fixture | aroundAll before | worker:', workerValue)
        await runSuite()
        console.log('>> fixture | aroundAll after | worker:', workerValue)
      })
      extendedTest('test1', ({ workerValue, staticValue, testValue }) => {
        console.log('>> fixture | test | static:', staticValue, 'worker:', workerValue, 'test:', testValue)
      })
    },
  })

  expect(stderr).toBe('')
  // Static and worker fixtures are available in hooks
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | workerValue setup | undefined
    >> fixture | aroundAll before | worker: worker-scoped
    >> fixture | testValue setup | test1
    >> fixture | test | static: static-value worker: worker-scoped test: test-scoped
    >> fixture | aroundAll after | worker: worker-scoped"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > test1 <time>"`)
})

test('test.override fixtures are scoped to their suite in beforeAll/afterAll', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(() => {
    return it.extend('value', { scope: 'worker' }, 'default')
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      // Override the value for this suite - the extended fixture is already
      // available in hooks, but override changes the value
      extendedTest.override('value', 'root')

      extendedTest.beforeAll(({ value }) => {
        console.log('>> fixture | root beforeAll |', value)
      })
      extendedTest.afterAll(({ value }) => {
        console.log('>> fixture | root afterAll |', value)
      })

      extendedTest('root test', ({ value }) => {
        expect(value).toBe('root')
      })
    },
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | root beforeAll | root
    >> fixture | root afterAll | root"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > root test <time>"`)
})

test('test.override fixtures are scoped to their suite in beforeAll/afterAll when called after hooks', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(() => {
    return it.extend('value', { scope: 'worker' }, 'default')
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest.beforeAll(({ value }) => {
        console.log('>> fixture | root beforeAll |', value)
      })
      extendedTest.afterAll(({ value }) => {
        console.log('>> fixture | root afterAll |', value)
      })

      extendedTest('root test', ({ value }) => {
        expect(value).toBe('root')
      })

      // Override the value for this suite - the extended fixture is already
      // available in hooks, but override changes the value
      extendedTest.override('value', 'root')
    },
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | root beforeAll | root
    >> fixture | root afterAll | root"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > root test <time>"`)
})

test('all hooks receive suite as the last argument', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(() => {
    return it.extend('value', { scope: 'file' }, 'test-value')
  }, {
    'basic.test.ts': ({ extendedTest, describe }) => {
      extendedTest.beforeAll(({ value }, suite) => {
        console.log('>> fixture | beforeAll suite:', suite.name, '| value:', value)
      })
      extendedTest.afterAll(({ value }, suite) => {
        console.log('>> fixture | afterAll suite:', suite.name, '| value:', value)
      })
      extendedTest.aroundAll(async (runSuite, { value }, suite) => {
        console.log('>> fixture | aroundAll before suite:', suite.name, '| value:', value)
        await runSuite()
        console.log('>> fixture | aroundAll after suite:', suite.name, '| value:', value)
      })

      extendedTest('root test', ({}) => {})

      describe('nested', () => {
        extendedTest.beforeAll(({ value }, suite) => {
          console.log('>> fixture | nested beforeAll suite:', suite.name, '| value:', value)
        })
        extendedTest.afterAll(({ value }, suite) => {
          console.log('>> fixture | nested afterAll suite:', suite.name, '| value:', value)
        })
        extendedTest('nested test', ({}) => {})
      })
    },
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | aroundAll before suite: basic.test.ts | value: test-value
    >> fixture | beforeAll suite: basic.test.ts | value: test-value
    >> fixture | nested beforeAll suite: nested | value: test-value
    >> fixture | nested afterAll suite: nested | value: test-value
    >> fixture | afterAll suite: basic.test.ts | value: test-value
    >> fixture | aroundAll after suite: basic.test.ts | value: test-value"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ basic.test.ts > root test <time>
     ✓ basic.test.ts > nested > nested test <time>"
  `)
})

test('nested fixtures with different scopes work correctly in hooks', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => {
    return it
      .extend('workerValue', { scope: 'worker' }, ({}, { onCleanup }) => {
        log('workerValue init')
        onCleanup(() => log('workerValue teardown'))
        return 'worker'
      })
      .extend('fileValue', { scope: 'file' }, ({ workerValue }, { onCleanup }) => {
        log('fileValue init (depends on workerValue:', workerValue, ')')
        onCleanup(() => log('fileValue teardown'))
        return `file+${workerValue}`
      })
  }, {
    'basic.test.ts': ({ extendedTest, describe }) => {
      // All scopes should be available in beforeAll/afterAll
      extendedTest.beforeAll(({ workerValue, fileValue }) => {
        console.log('>> fixture | root beforeAll | worker:', workerValue, 'file:', fileValue)
      })
      extendedTest.afterAll(({ workerValue, fileValue }) => {
        console.log('>> fixture | root afterAll | worker:', workerValue, 'file:', fileValue)
      })

      extendedTest('root test', ({ workerValue, fileValue }) => {
        console.log('>> fixture | root test | worker:', workerValue, 'file:', fileValue)
      })

      describe('nested', () => {
        extendedTest.beforeAll(({ workerValue, fileValue }) => {
          console.log('>> fixture | nested beforeAll | worker:', workerValue, 'file:', fileValue)
        })
        extendedTest('nested test', ({ workerValue, fileValue }) => {
          console.log('>> fixture | nested test | worker:', workerValue, 'file:', fileValue)
        })
      })
    },
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | workerValue init | undefined
    >> fixture | fileValue init (depends on workerValue: worker ) | undefined
    >> fixture | root beforeAll | worker: worker file: file+worker
    >> fixture | root test | worker: worker file: file+worker
    >> fixture | nested beforeAll | worker: worker file: file+worker
    >> fixture | nested test | worker: worker file: file+worker
    >> fixture | root afterAll | worker: worker file: file+worker
    >> fixture | fileValue teardown | nested > nested test
    >> fixture | workerValue teardown | nested > nested test"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ basic.test.ts > root test <time>
     ✓ basic.test.ts > nested > nested test <time>"
  `)
})

test('auto file fixture is initialised always before the first test', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => it.extend<{
    file: string
  }>({
    file: [
      async ({}, use) => {
        log('init file')
        await use('file')
        log('teardown file')
      },
      { scope: 'file', auto: true },
    ],
  }), {
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest('test1', ({}) => {})
      extendedTest('test2', ({}) => {})
      extendedTest('test3', ({ file: _file }) => {})
      extendedTest('test4', ({}) => {})
    },
  })

  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | init file | test1
    >> fixture | teardown file | test4"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ basic.test.ts > test1 <time>
     ✓ basic.test.ts > test2 <time>
     ✓ basic.test.ts > test3 <time>
     ✓ basic.test.ts > test4 <time>"
  `)
})

test.for([
  true,
  false,
])('file fixture is provided as a factory and is initialised once in all suites, teardown is called once per file (isolate %s)', async (isolate) => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => it.extend<{ file: string }>({
    file: [
      async ({}, use) => {
        log('init file')
        await use('file')
        log('teardown file')
      },
      { scope: 'file' },
    ],
  }), {
    'basic.test.js': ({ extendedTest, expect, describe }) => {
      extendedTest('[first] test 1', ({ file }) => {
        expect(file).toBe('file')
      })

      extendedTest('test 2', ({ file }) => {
        expect(file).toBe('file')
      })

      extendedTest('test 3', ({ file }) => {
        expect(file).toBe('file')
      })

      describe('suite 1', () => {
        extendedTest('test 1 1', ({ file }) => {
          expect(file).toBe('file')
        })

        extendedTest('test 1 2', ({ file }) => {
          expect(file).toBe('file')
        })

        describe('suite 2', () => {
          extendedTest('[first] test 1 2 1', ({ file }) => {
            expect(file).toBe('file')
          })
        })
      })
    },

    'second.test.js': ({ extendedTest, describe }) => {
      // doesn't access "file", not initialised
      extendedTest('[second] test 0', ({}) => {})
      // accesses "file" for the first time, initialised
      extendedTest('[second] test 1', ({ file: _file }) => {})
      extendedTest('[second] test 2', ({ file: _file }) => {})

      describe('suite 1', () => {
        extendedTest('[second] test 1', ({ file: _file }) => {})
      })
    },

    'third.test.js': ({ extendedTest }) => {
      // doesn't access "file" at all
      extendedTest('[third] test 0', ({}) => {})
    },
  }, {
    globals: true,
    isolate,
    maxWorkers: 1,
  })

  expect(stderr).toBe('')

  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | init file | [first] test 1
    >> fixture | teardown file | suite 1 > suite 2 > [first] test 1 2 1
    >> fixture | init file | [second] test 1
    >> fixture | teardown file | suite 1 > [second] test 1"
  `)

  expect(tests).toMatchInlineSnapshot(`
    " ✓ basic.test.js > [first] test 1 <time>
     ✓ basic.test.js > test 2 <time>
     ✓ basic.test.js > test 3 <time>
     ✓ basic.test.js > suite 1 > test 1 1 <time>
     ✓ basic.test.js > suite 1 > test 1 2 <time>
     ✓ basic.test.js > suite 1 > suite 2 > [first] test 1 2 1 <time>
     ✓ second.test.js > [second] test 0 <time>
     ✓ second.test.js > [second] test 1 <time>
     ✓ second.test.js > [second] test 2 <time>
     ✓ second.test.js > suite 1 > [second] test 1 <time>
     ✓ third.test.js > [third] test 0 <time>"
  `)
})

describe.for([
  { pool: 'forks' },
  { pool: 'threads' },
  {
    pool: 'browser',
    name: 'core',
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        { browser: 'chromium' as const, name: '' },
      ],
    },
  },
])('works properly in $pool', (options) => {
  test('file and worker fixtures are initiated', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => it.extend<{
      file: string
      worker: string
    }>({
      worker: [
        async ({}, use) => {
          log('init worker')
          await use('worker')
          log('teardown worker')
        },
        { scope: 'worker' },
      ],
      file: [
        async ({}, use) => {
          log('init file')
          await use('file')
          log('teardown file')
        },
        { scope: 'file' },
      ],
    }), {
      'basic.test.ts': ({ extendedTest }) => {
        extendedTest('test1', ({ file: _file, worker: _worker }) => {})
      },
      'vitest.config.js': { test: options },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | init worker | test1
      >> fixture | init file | test1
      >> fixture | teardown file | test1
      >> fixture | teardown worker | test1"
    `)
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > test1 <time>"`)
  })

  test('file and worker fixtures are initiated with auto', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => it.extend<{
      file: string
      worker: string
    }>({
      worker: [
        async ({}, use) => {
          log('init worker')
          await use('worker')
          log('teardown worker')
        },
        { scope: 'worker', auto: true },
      ],
      file: [
        async ({}, use) => {
          log('init file')
          await use('file')
          log('teardown file')
        },
        { scope: 'file', auto: true },
      ],
    }), {
      'basic.test.ts': ({ extendedTest }) => {
        extendedTest('test1', () => {})
      },
      'vitest.config.js': { test: options },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | init worker | test1
      >> fixture | init file | test1
      >> fixture | teardown file | test1
      >> fixture | teardown worker | test1"
    `)
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > test1 <time>"`)
  })
})

describe('browser tests', () => {
  test('initiates worker scope once for non-isolated tests', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => it.extend<{
      file: string
      worker: string
    }>({
      worker: [
        async ({}, use) => {
          log('init worker')
          await use('worker')
          log('teardown worker')
        },
        { scope: 'worker' },
      ],
      file: [
        async ({}, use) => {
          log('init file')
          await use('file')
          log('teardown file')
        },
        { scope: 'file' },
      ],
    }), {
      '1-basic.test.ts': ({ extendedTest }) => {
        extendedTest('test1', ({ file: _file, worker: _worker }) => {})
      },
      '2-basic.test.ts': ({ extendedTest }) => {
        extendedTest('test2', ({ file: _file, worker: _worker }) => {})
      },
      'vitest.config.js': {
        test: {
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            isolate: false,
            instances: [
              { browser: 'chromium' },
            ],
          },
        },
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | init worker | test1
      >> fixture | init file | test1
      >> fixture | teardown file | test1
      >> fixture | init file | test2
      >> fixture | teardown file | test2
      >> fixture | teardown worker | test2"
    `)
    expect(tests).toMatchInlineSnapshot(`
      " ✓ |chromium| 1-basic.test.ts > test1 <time>
       ✓ |chromium| 2-basic.test.ts > test2 <time>"
    `)
  })
})

test('file fixture cannot access test fixture at runtime', async () => {
  // This test verifies that the runtime prevents file fixtures from accessing test fixtures
  const { stderr } = await runInlineTests({
    'basic.test.ts': () => {
      const extendedTest = it.extend<
        {
          testFixture: string
          fileFixture: number
        }
      >({
        testFixture: ({}, use) => use('test'),
        fileFixture: [
          ({ testFixture }, use) => use(testFixture.length),
          { scope: 'file' },
        ],
      })

      extendedTest('not working', ({ fileFixture: _file }) => {})
    },
  }, { globals: true })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts [ basic.test.ts ]
    FixtureDependencyError: The file "fileFixture" fixture cannot depend on a test fixture "testFixture".
     ❯ basic.test.ts:2:27
          1| await (() => {
          2|   const extendedTest = it.extend({
           |                           ^
          3|     testFixture: ({}, use) => use("test"),
          4|     fileFixture: [
     ❯ basic.test.ts:11:1

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('scoped fixtures with tuple syntax work', async () => {
  const { stderr, fixtures, tests } = await runFixtureTests(({ log, expectTypeOf }) => it.extend<{
    $test: { testFixture: string }
    $file: { fileFixture: number }
    $worker: { workerFixture: boolean }
  }>({
    workerFixture: [async ({}, use) => {
      log('workerFixture setup')
      await use(true)
      log('workerFixture teardown')
    }, { scope: 'worker' }],
    fileFixture: [async ({ workerFixture }, use) => {
      // Confirm workerFixture is typed as boolean (file can access worker fixtures)
      expectTypeOf(workerFixture).toEqualTypeOf<boolean>()
      log('fileFixture setup', workerFixture)
      await use(workerFixture ? 42 : 0)
      log('fileFixture teardown')
    }, { scope: 'file' }],
    testFixture: async ({ fileFixture, workerFixture }, use) => {
      // Confirm fileFixture is typed as number, workerFixture as boolean (test can access all)
      expectTypeOf(fileFixture).toEqualTypeOf<number>()
      expectTypeOf(workerFixture).toEqualTypeOf<boolean>()
      log('testFixture setup', fileFixture, workerFixture)
      await use(`test-${fileFixture}-${workerFixture}`)
      log('testFixture teardown')
    },
  }), {
    'basic.test.ts': ({ extendedTest, expect, expectTypeOf }) => {
      extendedTest('test 1', ({ testFixture, fileFixture, workerFixture }) => {
        expectTypeOf(workerFixture).toEqualTypeOf<boolean>()
        expectTypeOf(fileFixture).toEqualTypeOf<number>()
        expectTypeOf(testFixture).toEqualTypeOf<string>()
        expect(workerFixture).toBe(true)
        expect(fileFixture).toBe(42)
        expect(testFixture).toBe('test-42-true')
      })
    },
  })
  expect(stderr).toBe('')
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | workerFixture setup | test 1
    >> fixture | fileFixture setup true | test 1
    >> fixture | testFixture setup 42 true | test 1
    >> fixture | testFixture teardown | test 1
    >> fixture | fileFixture teardown | test 1
    >> fixture | workerFixture teardown | test 1"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > test 1 <time>"`)
})

describe('scoped fixtures type safety', () => {
  test('types are correctly inferred for scoped fixtures', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log, expectTypeOf }) => it.extend<{
      $worker: { workerValue: boolean }
      $file: { fileValue: number }
      $test: { testValue: string }
    }>({
      workerValue: [async ({}, use) => {
        log('workerValue setup')
        await use(true)
        log('workerValue teardown')
      }, { scope: 'worker' }],
      fileValue: [async ({ workerValue }, use) => {
        // Confirm file fixture can access worker fixtures (workerValue is typed as boolean)
        expectTypeOf(workerValue).toEqualTypeOf<boolean>()
        log('fileValue setup', workerValue)
        await use(workerValue ? 42 : 0)
        log('fileValue teardown')
      }, { scope: 'file' }],
      testValue: async ({ fileValue, workerValue }, use) => {
        // Confirm test fixture can access both file and worker fixtures
        expectTypeOf(fileValue).toEqualTypeOf<number>()
        expectTypeOf(workerValue).toEqualTypeOf<boolean>()
        log('testValue setup', fileValue, workerValue)
        await use(`${fileValue}-${workerValue}`)
        log('testValue teardown')
      },
    }), {
      'basic.test.ts': ({ extendedTest, expect, expectTypeOf }) => {
        extendedTest('has correct types', ({ workerValue, fileValue, testValue }) => {
          // Verify the values and types are correct
          expectTypeOf(workerValue).toEqualTypeOf<boolean>()
          expectTypeOf(fileValue).toEqualTypeOf<number>()
          expectTypeOf(testValue).toEqualTypeOf<string>()
          expect(workerValue).toBe(true)
          expect(fileValue).toBe(42)
          expect(testValue).toBe('42-true')
        })
      },
    })
    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | workerValue setup | has correct types
      >> fixture | fileValue setup true | has correct types
      >> fixture | testValue setup 42 true | has correct types
      >> fixture | testValue teardown | has correct types
      >> fixture | fileValue teardown | has correct types
      >> fixture | workerValue teardown | has correct types"
    `)
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > has correct types <time>"`)
  })

  test('file fixture cannot access test-scoped fixtures (runtime error)', async () => {
    const { stderr } = await runFixtureTests(({ log, expectTypeOf: _expectTypeOf }) => it.extend<{
      $worker: { workerValue: boolean }
      $file: { fileValue: number }
      $test: { testValue: string }
    }>({
      workerValue: [async ({}, use) => {
        log('workerValue setup')
        await use(true)
        log('workerValue teardown')
      }, { scope: 'worker' }],
      // @ts-expect-error - file fixture cannot access test-scoped fixture 'testValue'
      fileValue: [async ({ testValue }, use) => {
        log('fileValue setup')
        await use(testValue.length)
        log('fileValue teardown')
      }, { scope: 'file' }],
      testValue: async ({}, use) => {
        log('testValue setup')
        await use('test')
        log('testValue teardown')
      },
    }), {
      'basic.test.ts': ({ extendedTest }) => {
        extendedTest('should fail', ({ fileValue: _fileValue }) => {})
      },
    })
    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  basic.test.ts [ basic.test.ts ]
      FixtureDependencyError: The file "fileValue" fixture cannot depend on a test fixture "testValue".
       ❯ test.js:5:75
            3| export const expect = globalThis.expect
            4| export const expectTypeOf = globalThis.expectTypeOf
            5| export const extendedTest = (({ log, expectTypeOf: _expectTypeOf }) =>…
             |                                                                           ^
            6|   workerValue: [async ({}, use) => {
            7|     log("workerValue setup");
       ❯ test.js:22:4

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  })

  test('worker fixture cannot access file-scoped fixtures (runtime error)', async () => {
    const { stderr } = await runFixtureTests(({ log, expectTypeOf: _expectTypeOf }) => it.extend<{
      $worker: { workerValue: boolean }
      $file: { fileValue: number }
      $test: { testValue: string }
    }>({
      // @ts-expect-error - worker fixture cannot access file-scoped fixture 'fileValue'
      workerValue: [async ({ fileValue }, use) => {
        log('workerValue setup')
        await use(fileValue > 0)
        log('workerValue teardown')
      }, { scope: 'worker' }],
      fileValue: [async ({}, use) => {
        log('fileValue setup')
        await use(42)
        log('fileValue teardown')
      }, { scope: 'file' }],
      testValue: async ({}, use) => {
        log('testValue setup')
        await use('test')
        log('testValue teardown')
      },
    }), {
      'basic.test.ts': ({ extendedTest }) => {
        extendedTest('should fail', ({ workerValue: _workerValue }) => {})
      },
    })
    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  basic.test.ts [ basic.test.ts ]
      FixtureDependencyError: The worker "workerValue" fixture cannot depend on a file fixture "fileValue".
       ❯ test.js:5:75
            3| export const expect = globalThis.expect
            4| export const expectTypeOf = globalThis.expectTypeOf
            5| export const extendedTest = (({ log, expectTypeOf: _expectTypeOf }) =>…
             |                                                                           ^
            6|   // @ts-expect-error - worker fixture cannot access file-scoped fixtu…
            7|   workerValue: [async ({ fileValue }, use) => {
       ❯ test.js:22:4

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  })

  test('worker fixture cannot access test-scoped fixtures (runtime error)', async () => {
    const { stderr } = await runFixtureTests(({ log, expectTypeOf: _expectTypeOf }) => it.extend<{
      $worker: { workerValue: boolean }
      $file: { fileValue: number }
      $test: { testValue: string }
    }>({
      // @ts-expect-error - worker fixture cannot access test-scoped fixture 'testValue'
      workerValue: [async ({ testValue }, use) => {
        log('workerValue setup')
        await use(testValue.length > 0)
        log('workerValue teardown')
      }, { scope: 'worker' }],
      fileValue: [async ({}, use) => {
        log('fileValue setup')
        await use(42)
        log('fileValue teardown')
      }, { scope: 'file' }],
      testValue: async ({}, use) => {
        log('testValue setup')
        await use('test')
        log('testValue teardown')
      },
    }), {
      'basic.test.ts': ({ extendedTest }) => {
        extendedTest('should fail', ({ workerValue: _workerValue }) => {})
      },
    })
    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  basic.test.ts [ basic.test.ts ]
      FixtureDependencyError: The worker "workerValue" fixture cannot depend on a test fixture "testValue".
       ❯ test.js:5:75
            3| export const expect = globalThis.expect
            4| export const expectTypeOf = globalThis.expectTypeOf
            5| export const extendedTest = (({ log, expectTypeOf: _expectTypeOf }) =>…
             |                                                                           ^
            6|   // @ts-expect-error - worker fixture cannot access test-scoped fixtu…
            7|   workerValue: [async ({ testValue }, use) => {
       ❯ test.js:22:4

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  })

  test('scoped fixtures accept additional options (auto)', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log, expectTypeOf: _expectTypeOf }) => it.extend<{
      $worker: { workerValue: boolean }
      $file: { fileValue: number }
    }>({
      workerValue: [async ({}, use) => {
        log('workerValue setup')
        await use(true)
        log('workerValue teardown')
      }, { scope: 'worker', auto: true }],
      fileValue: [async ({}, use) => {
        log('fileValue setup')
        await use(42)
        log('fileValue teardown')
      }, { scope: 'file', auto: true }],
    }), {
      'basic.test.ts': ({ extendedTest }) => {
        // auto fixtures should initialize even without being explicitly requested
        extendedTest('auto fixtures work', ({}) => {})
      },
    })
    expect(stderr).toBe('')
    // Auto fixtures initialize even when not explicitly requested
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | workerValue setup | auto fixtures work
      >> fixture | fileValue setup | auto fixtures work
      >> fixture | fileValue teardown | auto fixtures work
      >> fixture | workerValue teardown | auto fixtures work"
    `)
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > auto fixtures work <time>"`)
  })

  test('file fixture cannot access TestContext properties like task (type and runtime error)', async () => {
    const { stderr } = await runFixtureTests(({ log, expectTypeOf: _expectTypeOf }) => it.extend<{
      $file: { fileValue: string }
      $test: { testValue: number }
    }>({
      // @ts-expect-error - file fixture cannot access 'task' from TestContext
      fileValue: [async ({ task }, use) => {
        log('fileValue setup')
        await use(task.name)
        log('fileValue teardown')
      }, { scope: 'file' }],
      testValue: async ({}, use) => {
        log('testValue setup')
        await use(42)
        log('testValue teardown')
      },
    }), {
      'basic.test.ts': ({ extendedTest }) => {
        extendedTest('should fail', ({ fileValue: _fileValue }) => {})
      },
    })
    // Runtime error because 'task' is not available in file fixtures
    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  basic.test.ts > should fail
      TypeError: Cannot read properties of undefined (reading 'name')
       ❯ it.extend.fileValue.scope test.js:9:20
            7|   fileValue: [async ({ task }, use) => {
            8|     log("fileValue setup");
            9|     await use(task.name);
             |                    ^
           10|     log("fileValue teardown");
           11|   }, { scope: "file" }],

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  })

  test('worker fixture cannot access TestContext properties like task (type and runtime error)', async () => {
    const { stderr } = await runFixtureTests(({ log, expectTypeOf: _expectTypeOf }) => it.extend<{
      $worker: { workerValue: string }
      $test: { testValue: number }
    }>({
      // @ts-expect-error - worker fixture cannot access 'task' from TestContext
      workerValue: [async ({ task }, use) => {
        log('workerValue setup')
        await use(task.name)
        log('workerValue teardown')
      }, { scope: 'worker' }],
      testValue: async ({}, use) => {
        log('testValue setup')
        await use(42)
        log('testValue teardown')
      },
    }), {
      'basic.test.ts': ({ extendedTest }) => {
        extendedTest('should fail', ({ workerValue: _workerValue }) => {})
      },
    })
    // Runtime error because 'task' is not available in worker fixtures
    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  basic.test.ts > should fail
      TypeError: Cannot read properties of undefined (reading 'name')
       ❯ it.extend.workerValue.scope test.js:9:20
            7|   workerValue: [async ({ task }, use) => {
            8|     log("workerValue setup");
            9|     await use(task.name);
             |                    ^
           10|     log("workerValue teardown");
           11|   }, { scope: "worker" }],

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  })
})

describe('builder pattern API with automatic type inference', () => {
  test('types are automatically inferred from return values', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log, expectTypeOf }) => {
      return it
        .extend('workerValue', { scope: 'worker' }, async () => {
          log('workerValue setup')
          return 123
        })
        .extend('fileValue', { scope: 'file' }, async ({ workerValue }) => {
          // TypeScript automatically knows workerValue is number
          expectTypeOf(workerValue).toEqualTypeOf<number>()
          log('fileValue setup', workerValue)
          return workerValue > 100
        })
        .extend('testValue', async ({ workerValue, fileValue }) => {
          // TypeScript automatically knows both types
          expectTypeOf(workerValue).toEqualTypeOf<number>()
          expectTypeOf(fileValue).toEqualTypeOf<boolean>()
          log('testValue setup', workerValue, fileValue)
          return { num: workerValue, bool: fileValue }
        })
    }, {
      'basic.test.ts': ({ extendedTest, expect, expectTypeOf }) => {
        extendedTest('builder pattern provides correct types and values', ({ workerValue, fileValue, testValue }) => {
          // Verify types are automatically inferred
          expectTypeOf(workerValue).toEqualTypeOf<number>()
          expectTypeOf(fileValue).toEqualTypeOf<boolean>()
          expectTypeOf(testValue).toEqualTypeOf<{ num: number; bool: boolean }>()

          // Verify values
          expect(workerValue).toBe(123)
          expect(fileValue).toBe(true)
          expect(testValue).toEqual({ num: 123, bool: true })
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | workerValue setup | builder pattern provides correct types and values
      >> fixture | fileValue setup 123 | builder pattern provides correct types and values
      >> fixture | testValue setup 123 true | builder pattern provides correct types and values"
    `)
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > builder pattern provides correct types and values <time>"`)
  })

  test('builder pattern without options defaults to test scope', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log, expectTypeOf }) => {
      return it
        // No need to pass {} when not using any dependencies
        .extend('count', async () => {
          log('count setup')
          return 42
        })
        .extend('doubled', async ({ count }) => {
          expectTypeOf(count).toEqualTypeOf<number>()
          log('doubled setup', count)
          return count * 2
        })
    }, {
      'basic.test.ts': ({ extendedTest, expect, expectTypeOf }) => {
        extendedTest('test scope fixtures work', ({ count, doubled }) => {
          expectTypeOf(count).toEqualTypeOf<number>()
          expectTypeOf(doubled).toEqualTypeOf<number>()

          expect(count).toBe(42)
          expect(doubled).toBe(84)
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | count setup | test scope fixtures work
      >> fixture | doubled setup 42 | test scope fixtures work"
    `)
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > test scope fixtures work <time>"`)
  })

  test('can mix builder pattern with object-based extend', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log, expectTypeOf }) => {
      return it
        .extend('first', async () => {
          log('first setup')
          return 'hello'
        })
        .extend<{ second: number }>({
          second: 100,
        })
        .extend('third', async ({ first, second }) => {
          expectTypeOf(first).toEqualTypeOf<string>()
          expectTypeOf(second).toEqualTypeOf<number>()
          log('third setup', first, second)
          return `${first}-${second}`
        })
    }, {
      'basic.test.ts': ({ extendedTest, expect, expectTypeOf }) => {
        extendedTest('mixed patterns work', ({ first, second, third }) => {
          expectTypeOf(first).toEqualTypeOf<string>()
          expectTypeOf(second).toEqualTypeOf<number>()
          expectTypeOf(third).toEqualTypeOf<string>()

          expect(first).toBe('hello')
          expect(second).toBe(100)
          expect(third).toBe('hello-100')
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | first setup | mixed patterns work
      >> fixture | third setup hello 100 | mixed patterns work"
    `)
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > mixed patterns work <time>"`)
  })

  test('non-function values work in builder pattern', async () => {
    const { stderr, tests } = await runFixtureTests(({ expectTypeOf }) => {
      return it
        .extend('stringValue', 'hello')
        .extend('numberValue', 42)
        .extend('arrayValue', [1, 2, 3])
        .extend('objectValue', { key: 'value' })
        .extend('combined', async ({ stringValue, numberValue }) => {
          expectTypeOf(stringValue).toEqualTypeOf<string>()
          expectTypeOf(numberValue).toEqualTypeOf<number>()
          return `${stringValue}-${numberValue}`
        })
    }, {
      'basic.test.ts': ({ extendedTest, expect, expectTypeOf }) => {
        extendedTest('non-function values work', ({ stringValue, numberValue, arrayValue, objectValue, combined }) => {
          expectTypeOf(stringValue).toEqualTypeOf<string>()
          expectTypeOf(numberValue).toEqualTypeOf<number>()
          expectTypeOf(arrayValue).toEqualTypeOf<number[]>()
          expectTypeOf(objectValue).toEqualTypeOf<{ key: string }>()
          expectTypeOf(combined).toEqualTypeOf<string>()

          expect(stringValue).toBe('hello')
          expect(numberValue).toBe(42)
          expect(arrayValue).toEqual([1, 2, 3])
          expect(objectValue).toEqual({ key: 'value' })
          expect(combined).toBe('hello-42')
        })
      },
    })

    expect(stderr).toBe('')
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > non-function values work <time>"`)
  })

  test('object with injected is treated as an object', async () => {
    const { stderr, tests } = await runFixtureTests(({}) => {
      return it
        .extend('object', { injected: true })
    }, {
      'basic.test.ts': ({ extendedTest, expect, expectTypeOf }) => {
        extendedTest('object with injected is treated as an object', ({ object }) => {
          expectTypeOf(object).toEqualTypeOf<{ injected: boolean }>()
          expect(object).toEqual({ injected: true })
        })
      },
    })
    expect(stderr).toBe('')
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > object with injected is treated as an object <time>"`)
  })

  test('non-function values with injected option work', async () => {
    const { stderr, tests } = await runFixtureTests(({ expectTypeOf }) => {
      return it
        // Static values only support 'injected' option
        .extend('apiUrl', { injected: true }, 'https://api.example.com')
        .extend('config', { port: 3000, host: 'localhost' })
        .extend('computed', async ({ apiUrl, config }) => {
          expectTypeOf(apiUrl).toEqualTypeOf<string>()
          expectTypeOf(config).toEqualTypeOf<{ port: number; host: string }>()
          return `${apiUrl}:${config.port}`
        })
    }, {
      'basic.test.ts': ({ extendedTest, expect, expectTypeOf }) => {
        extendedTest('non-function values with injected option work', ({ apiUrl, config, computed }) => {
          expectTypeOf(apiUrl).toEqualTypeOf<string>()
          expectTypeOf(config).toEqualTypeOf<{ port: number; host: string }>()
          expectTypeOf(computed).toEqualTypeOf<string>()

          expect(apiUrl).toBe('https://injected.example.com')
          expect(config).toEqual({ port: 3000, host: 'localhost' })
          expect(computed).toBe('https://injected.example.com:3000')
        })
      },
      'vitest.config.js': {
        test: {
          provide: {
            apiUrl: 'https://injected.example.com',
          } as any, // requires type pollution otherwise
        },
      },
    })

    expect(stderr).toBe('')
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > non-function values with injected option work <time>"`)
  })

  test('extending the extended', async () => {
    const { stderr, tests } = await runFixtureTests(() => {
      return it
        .extend('apiUrl', 'https://api.example.com')
        .extend(
          'apiUrl',
          // @ts-expect-error false should be string
          false,
        )
    }, {
      'basic.test.ts': ({ extendedTest, expect, expectTypeOf }) => {
        extendedTest('onCleanup works', ({ apiUrl }) => {
          expectTypeOf(apiUrl).toEqualTypeOf<string>()
          // runtime overrides, but ts shows an error
          // we don't enforce it because it's possible to provide objects
          // which are hard to compare at runtime
          expect(apiUrl).toBe(false)
        })
      },
    })
    expect(stderr).toBe('')
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > onCleanup works <time>"`)
  })

  test('dependencies in extended extend use the new extended value', async () => {
    const { stderr, tests } = await runFixtureTests(() => {
      return it
        .extend('a', () => 1)
        .extend('b', ({ a }) => a + 1)
        .extend('a', () => 100)
    }, {
      'basic.test.ts': ({ extendedTest, expect }) => {
        extendedTest('direct access returns new value', ({ a }) => {
          expect(a).toBe(100)
        })

        extendedTest('dependent access returns new value', ({ b }) => {
          expect(b).toBe(101)
        })
      },
    })
    expect(stderr).toBe('')
    expect(tests).toMatchInlineSnapshot(`
      " ✓ basic.test.ts > direct access returns new value <time>
       ✓ basic.test.ts > dependent access returns new value <time>"
    `)
  })

  test('onCleanup registers teardown function', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => {
      return it.extend('resource', { scope: 'file' }, async ({}, { onCleanup }) => {
        const resource = { id: 42, data: 'test' }
        log('resource setup')
        onCleanup(() => {
          log('resource cleanup', resource.id)
        })
        return resource
      })
    }, {
      'basic.test.ts': ({ extendedTest, expect }) => {
        extendedTest('onCleanup works', ({ resource }) => {
          expect(resource).toEqual({ id: 42, data: 'test' })
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | resource setup | onCleanup works
      >> fixture | resource cleanup 42 | onCleanup works"
    `)
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > onCleanup works <time>"`)
  })

  test('builder pattern with auto option', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => {
      return it
        .extend('autoValue', { auto: true }, async () => {
          log('autoValue setup')
          return 'auto-initialized'
        })
        .extend('regularValue', async () => {
          log('regularValue setup')
          return 'regular'
        })
    }, {
      'basic.test.ts': ({ extendedTest, expect }) => {
        extendedTest('auto fixture is initialized even when not used', ({ regularValue }) => {
          expect(regularValue).toBe('regular')
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | autoValue setup | auto fixture is initialized even when not used
      >> fixture | regularValue setup | auto fixture is initialized even when not used"
    `)
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > auto fixture is initialized even when not used <time>"`)
  })

  test('onCleanup can only be called once per fixture', async () => {
    const { stderr } = await runFixtureTests(({ log }) => {
      return it.extend('resource', async ({}, { onCleanup }) => {
        log('resource setup')
        onCleanup(() => log('cleanup 1'))
        onCleanup(() => log('cleanup 2')) // This should throw
        return 'value'
      })
    }, {
      'basic.test.ts': ({ extendedTest, expect }) => {
        extendedTest('should fail because onCleanup called twice', ({ resource }) => {
          expect(resource).toBe('value')
        })
      },
    })
    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  basic.test.ts > should fail because onCleanup called twice
      Error: onCleanup can only be called once per fixture. Define separate fixtures if you need multiple cleanup functions.
       ❯ test.js:9:5
            7|     log("resource setup");
            8|     onCleanup(() => log("cleanup 1"));
            9|     onCleanup(() => log("cleanup 2"));
             |     ^
           10|     return "value";
           11|   });

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  })

  test('nested fixtures cleanup in correct order (dependent cleaned up first)', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => {
      return it
        .extend('base', async ({}, { onCleanup }) => {
          log('base setup')
          onCleanup(() => log('base cleanup'))
          return 1
        })
        .extend('middle', async ({ base }, { onCleanup }) => {
          log('middle setup', base)
          onCleanup(() => log('middle cleanup'))
          return base + 10
        })
        .extend('top', async ({ middle }, { onCleanup }) => {
          log('top setup', middle)
          onCleanup(() => log('top cleanup'))
          return middle + 100
        })
    }, {
      'basic.test.ts': ({ extendedTest, expect }) => {
        extendedTest('fixtures are cleaned up in reverse dependency order', ({ top }) => {
          expect(top).toBe(111)
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | base setup | fixtures are cleaned up in reverse dependency order
      >> fixture | middle setup 1 | fixtures are cleaned up in reverse dependency order
      >> fixture | top setup 11 | fixtures are cleaned up in reverse dependency order
      >> fixture | top cleanup | fixtures are cleaned up in reverse dependency order
      >> fixture | middle cleanup | fixtures are cleaned up in reverse dependency order
      >> fixture | base cleanup | fixtures are cleaned up in reverse dependency order"
    `)
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > fixtures are cleaned up in reverse dependency order <time>"`)
  })

  test('cleanup order across different scopes', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => {
      return it
        .extend('workerFixture', { scope: 'worker' }, async ({}, { onCleanup }) => {
          log('worker setup')
          onCleanup(() => log('worker cleanup'))
          return 'worker'
        })
        .extend('fileFixture', { scope: 'file' }, async ({ workerFixture }, { onCleanup }) => {
          log('file setup', workerFixture)
          onCleanup(() => log('file cleanup'))
          return 'file'
        })
        .extend('testFixture', async ({ fileFixture }, { onCleanup }) => {
          log('test setup', fileFixture)
          onCleanup(() => log('test cleanup'))
          return 'test'
        })
    }, {
      'basic.test.ts': ({ extendedTest, expect }) => {
        extendedTest('scoped fixtures cleanup in order', ({ testFixture }) => {
          expect(testFixture).toBe('test')
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | worker setup | scoped fixtures cleanup in order
      >> fixture | file setup worker | scoped fixtures cleanup in order
      >> fixture | test setup file | scoped fixtures cleanup in order
      >> fixture | test cleanup | scoped fixtures cleanup in order
      >> fixture | file cleanup | scoped fixtures cleanup in order
      >> fixture | worker cleanup | scoped fixtures cleanup in order"
    `)
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > scoped fixtures cleanup in order <time>"`)
  })

  test('deep fixture chain with all scopes and cleanups', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log, expectTypeOf }) => {
      return it
        .extend('config', { scope: 'worker' }, async ({}, { onCleanup }) => {
          log('config setup')
          onCleanup(() => log('config cleanup'))
          return { port: 3000, host: 'localhost' }
        })
        .extend('connection', { scope: 'worker' }, async ({ config }, { onCleanup }) => {
          expectTypeOf(config).toEqualTypeOf<{ port: number; host: string }>()
          log('connection setup', config.port)
          onCleanup(() => log('connection cleanup'))
          return `${config.host}:${config.port}`
        })
        .extend('database', { scope: 'file' }, async ({ connection }, { onCleanup }) => {
          expectTypeOf(connection).toEqualTypeOf<string>()
          log('database setup', connection)
          onCleanup(() => log('database cleanup'))
          return { url: connection, connected: true }
        })
        .extend('transaction', async ({ database }, { onCleanup }) => {
          expectTypeOf(database).toEqualTypeOf<{ url: string; connected: boolean }>()
          log('transaction setup', database.connected)
          onCleanup(() => log('transaction rollback'))
          return { id: 1, db: database }
        })
        .extend('query', async ({ transaction }) => {
          expectTypeOf(transaction).toEqualTypeOf<{ id: number; db: { url: string; connected: boolean } }>()
          log('query setup', transaction.id)
          return `SELECT * FROM ${transaction.id}`
        })
    }, {
      'basic.test.ts': ({ extendedTest, expect, expectTypeOf }) => {
        extendedTest('deep chain works correctly', ({ config, connection, database, transaction, query }) => {
          expectTypeOf(config).toEqualTypeOf<{ port: number; host: string }>()
          expectTypeOf(connection).toEqualTypeOf<string>()
          expectTypeOf(database).toEqualTypeOf<{ url: string; connected: boolean }>()
          expectTypeOf(transaction).toEqualTypeOf<{ id: number; db: { url: string; connected: boolean } }>()
          expectTypeOf(query).toEqualTypeOf<string>()

          expect(config).toEqual({ port: 3000, host: 'localhost' })
          expect(connection).toBe('localhost:3000')
          expect(database).toEqual({ url: 'localhost:3000', connected: true })
          expect(transaction).toEqual({ id: 1, db: { url: 'localhost:3000', connected: true } })
          expect(query).toBe('SELECT * FROM 1')
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | config setup | deep chain works correctly
      >> fixture | connection setup 3000 | deep chain works correctly
      >> fixture | database setup localhost:3000 | deep chain works correctly
      >> fixture | transaction setup true | deep chain works correctly
      >> fixture | query setup 1 | deep chain works correctly
      >> fixture | transaction rollback | deep chain works correctly
      >> fixture | database cleanup | deep chain works correctly
      >> fixture | connection cleanup | deep chain works correctly
      >> fixture | config cleanup | deep chain works correctly"
    `)
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > deep chain works correctly <time>"`)
  })

  test('fixture without onCleanup works correctly', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => {
      return it
        .extend('noCleanup', async () => {
          log('noCleanup setup')
          return 'no cleanup needed'
        })
        .extend('withCleanup', async ({ noCleanup }, { onCleanup }) => {
          log('withCleanup setup', noCleanup)
          onCleanup(() => log('withCleanup cleanup'))
          return 'has cleanup'
        })
    }, {
      'basic.test.ts': ({ extendedTest, expect }) => {
        extendedTest('mixed cleanup works', ({ noCleanup, withCleanup }) => {
          expect(noCleanup).toBe('no cleanup needed')
          expect(withCleanup).toBe('has cleanup')
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | noCleanup setup | mixed cleanup works
      >> fixture | withCleanup setup no cleanup needed | mixed cleanup works
      >> fixture | withCleanup cleanup | mixed cleanup works"
    `)
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > mixed cleanup works <time>"`)
  })

  test('fixture reuses value across multiple tests in same scope', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => {
      return it
        .extend('fileCounter', { scope: 'file' }, async ({}, { onCleanup }) => {
          log('fileCounter setup')
          onCleanup(() => log('fileCounter cleanup'))
          return { count: 0 }
        })
        .extend('testValue', async ({ fileCounter }) => {
          fileCounter.count++
          log('testValue setup', fileCounter.count)
          return fileCounter.count
        })
    }, {
      'basic.test.ts': ({ extendedTest, expect }) => {
        extendedTest('first test', ({ testValue }) => {
          expect(testValue).toBe(1)
        })
        extendedTest('second test', ({ testValue }) => {
          expect(testValue).toBe(2)
        })
        extendedTest('third test', ({ testValue }) => {
          expect(testValue).toBe(3)
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | fileCounter setup | first test
      >> fixture | testValue setup 1 | first test
      >> fixture | testValue setup 2 | second test
      >> fixture | testValue setup 3 | third test
      >> fixture | fileCounter cleanup | third test"
    `)
    expect(tests).toMatchInlineSnapshot(`
      " ✓ basic.test.ts > first test <time>
       ✓ basic.test.ts > second test <time>
       ✓ basic.test.ts > third test <time>"
    `)
  })

  test('async cleanup functions work correctly', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => {
      return it.extend('asyncResource', async ({}, { onCleanup }) => {
        log('asyncResource setup')
        onCleanup(async () => {
          log('async cleanup start')
          await new Promise(resolve => setTimeout(resolve, 10))
          log('async cleanup done')
        })
        return 'async'
      })
    }, {
      'basic.test.ts': ({ extendedTest, expect }) => {
        extendedTest('async cleanup works', ({ asyncResource }) => {
          expect(asyncResource).toBe('async')
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | asyncResource setup | async cleanup works
      >> fixture | async cleanup start | async cleanup works
      >> fixture | async cleanup done | async cleanup works"
    `)
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > async cleanup works <time>"`)
  })

  test('file fixture cannot access test fixture (runtime and type error)', async () => {
    const { stderr } = await runFixtureTests(({ log }) => {
      return it
        .extend('testValue', async () => {
          log('testValue setup')
          return 'test'
        })
        // @ts-expect-error - file fixture cannot access test-scoped fixture 'testValue'
        .extend('fileValue', { scope: 'file' }, async ({ testValue }) => {
          log('fileValue setup', testValue)
          return testValue.length
        })
    }, {
      'basic.test.ts': ({ extendedTest }) => {
        extendedTest('should fail', ({ fileValue: _fileValue }) => {})
      },
    })
    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  basic.test.ts [ basic.test.ts ]
      FixtureDependencyError: The file "fileValue" fixture cannot depend on a test fixture "testValue".
       ❯ test.js:9:6
            7|     log("testValue setup");
            8|     return "test";
            9|   }).extend("fileValue", { scope: "file" }, async ({ testValue }) => {
             |      ^
           10|     log("fileValue setup", testValue);
           11|     return testValue.length;
       ❯ test.js:13:3

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  })

  test('worker fixture cannot access file fixture (runtime and type error)', async () => {
    const { stderr } = await runFixtureTests(({ log }) => {
      return it
        .extend('fileValue', { scope: 'file' }, async () => {
          log('fileValue setup')
          return 42
        })
        // @ts-expect-error - worker fixture cannot access file-scoped fixture 'fileValue'
        .extend('workerValue', { scope: 'worker' }, async ({ fileValue }) => {
          log('workerValue setup', fileValue)
          return fileValue > 0
        })
    }, {
      'basic.test.ts': ({ extendedTest }) => {
        extendedTest('should fail', ({ workerValue: _workerValue }) => {})
      },
    })
    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  basic.test.ts [ basic.test.ts ]
      FixtureDependencyError: The worker "workerValue" fixture cannot depend on a file fixture "fileValue".
       ❯ test.js:9:6
            7|     log("fileValue setup");
            8|     return 42;
            9|   }).extend("workerValue", { scope: "worker" }, async ({ fileValue }) …
             |      ^
           10|     log("workerValue setup", fileValue);
           11|     return fileValue > 0;
       ❯ test.js:13:3

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  })

  test('worker fixture cannot access test fixture (runtime and type error)', async () => {
    const { stderr } = await runFixtureTests(({ log }) => {
      return it
        .extend('testValue', async () => {
          log('testValue setup')
          return 'test'
        })
        // @ts-expect-error - worker fixture cannot access test-scoped fixture 'testValue'
        .extend('workerValue', { scope: 'worker' }, async ({ testValue }) => {
          log('workerValue setup', testValue)
          return testValue.length > 0
        })
    }, {
      'basic.test.ts': ({ extendedTest }) => {
        extendedTest('should fail', ({ workerValue: _workerValue }) => {})
      },
    })

    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  basic.test.ts [ basic.test.ts ]
      FixtureDependencyError: The worker "workerValue" fixture cannot depend on a test fixture "testValue".
       ❯ test.js:9:6
            7|     log("testValue setup");
            8|     return "test";
            9|   }).extend("workerValue", { scope: "worker" }, async ({ testValue }) …
             |      ^
           10|     log("workerValue setup", testValue);
           11|     return testValue.length > 0;
       ❯ test.js:13:3

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  })

  test('cleanup error is reported', async () => {
    const { stderr, fixtures } = await runFixtureTests(({ log }) => {
      return it.extend('resource', async ({}, { onCleanup }) => {
        log('resource setup')
        onCleanup(() => {
          log('cleanup - throwing')
          throw new Error('cleanup error')
        })
        return 'value'
      })
    }, {
      'basic.test.ts': ({ extendedTest, expect }) => {
        extendedTest('test runs but cleanup fails', ({ resource }) => {
          expect(resource).toBe('value')
        })
      },
    })

    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | resource setup | test runs but cleanup fails
      >> fixture | cleanup - throwing | test runs but cleanup fails"
    `)
    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  basic.test.ts > test runs but cleanup fails
       FAIL  basic.test.ts > test runs but cleanup fails
      Error: cleanup error
       ❯ test.js:10:13
            8|     onCleanup(() => {
            9|       log("cleanup - throwing");
           10|       throw new Error("cleanup error");
             |             ^
           11|     });
           12|     return "value";

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

      "
    `)
  })
})

describe('test.override builder pattern', () => {
  test('override with static value', async () => {
    const { stderr, tests } = await runFixtureTests(({ expectTypeOf: _expectTypeOf }) => {
      return it
        .extend('config', { port: 3000, host: 'localhost' })
        .extend('url', ({ config }) => `http://${config.host}:${config.port}`)
    }, {
      'basic.test.ts': ({ extendedTest, expect, expectTypeOf, describe }) => {
        extendedTest('uses default', ({ config, url }) => {
          expectTypeOf(config).toEqualTypeOf<{ port: number; host: string }>()
          expect(config.port).toBe(3000)
          expect(url).toBe('http://localhost:3000')
        })

        describe('with overwritten port', () => {
          extendedTest.override('config', { port: 4000, host: 'localhost' })

          extendedTest('uses overwritten value', ({ config, url }) => {
            expect(config.port).toBe(4000)
            expect(url).toBe('http://localhost:4000')
          })
        })
      },
    })

    expect(stderr).toBe('')
    expect(tests).toMatchInlineSnapshot(`
      " ✓ basic.test.ts > uses default <time>
       ✓ basic.test.ts > with overwritten port > uses overwritten value <time>"
    `)
  })

  test('override with function that uses dependencies from original test', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => {
      return it
        .extend('config', { port: 3000 })
        .extend('server', async ({ config }, { onCleanup }) => {
          log('server setup', config.port)
          onCleanup(() => log('server cleanup'))
          return { port: config.port, running: true }
        })
    }, {
      'basic.test.ts': ({ extendedTest, expect, describe }) => {
        extendedTest('uses default server', ({ server }) => {
          expect(server.port).toBe(3000)
        })

        describe('with custom server', () => {
          // override with a function that uses 'config' from the original test
          extendedTest.override('server', async ({ config }, { onCleanup }) => {
            console.log('>> fixture | custom server setup', config.port, '|', expect.getState().currentTestName)
            onCleanup(() => console.log('>> fixture | custom server cleanup |', expect.getState().currentTestName))
            return { port: config.port + 1000, running: false }
          })

          extendedTest('uses custom server', ({ server }) => {
            expect(server.port).toBe(4000)
            expect(server.running).toBe(false)
          })
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | server setup 3000 | uses default server
      >> fixture | server cleanup | uses default server
      >> fixture | custom server setup 3000 | with custom server > uses custom server
      >> fixture | custom server cleanup | with custom server > uses custom server"
    `)
    expect(tests).toMatchInlineSnapshot(`
      " ✓ basic.test.ts > uses default server <time>
       ✓ basic.test.ts > with custom server > uses custom server <time>"
    `)
  })

  test('override with object syntax (backward compatible)', async () => {
    const { stderr, tests } = await runFixtureTests(() => {
      return it
        .extend('value', 'original')
        .extend('derived', ({ value }) => `derived-${value}`)
    }, {
      'basic.test.ts': ({ extendedTest, expect, describe }) => {
        extendedTest('uses default', ({ value, derived }) => {
          expect(value).toBe('original')
          expect(derived).toBe('derived-original')
        })

        describe('overwritten with object syntax', () => {
          extendedTest.override({ value: 'overwritten' })

          extendedTest('uses overwritten', ({ value, derived }) => {
            expect(value).toBe('overwritten')
            expect(derived).toBe('derived-overwritten')
          })
        })
      },
    })

    expect(stderr).toBe('')
    expect(tests).toMatchInlineSnapshot(`
      " ✓ basic.test.ts > uses default <time>
       ✓ basic.test.ts > overwritten with object syntax > uses overwritten <time>"
    `)
  })

  test('scoped is deprecated but still works', async () => {
    const { stderr, tests } = await runFixtureTests(() => {
      return it
        .extend('value', 'original')
    }, {
      'basic.test.ts': ({ extendedTest, expect, describe }) => {
        describe('using deprecated scoped', () => {
          // scoped is deprecated, use override instead
          extendedTest.scoped({ value: 'scoped-value' })

          extendedTest('scoped still works', ({ value }) => {
            expect(value).toBe('scoped-value')
          })
        })
      },
    })

    expect(stderr).toContain('test.scoped() is deprecated and will be removed in future versions. Please use test.override() instead.')
    expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > using deprecated scoped > scoped still works <time>"`)
  })

  test('override nested describe inheritance', async () => {
    const { stderr, tests } = await runFixtureTests(() => {
      return it
        .extend('level', 'root')
    }, {
      'basic.test.ts': ({ extendedTest, expect, describe }) => {
        extendedTest('root level', ({ level }) => {
          expect(level).toBe('root')
        })

        describe('level 1', () => {
          extendedTest.override('level', 'one')

          extendedTest('at level 1', ({ level }) => {
            expect(level).toBe('one')
          })

          describe('level 2', () => {
            extendedTest.override('level', 'two')

            extendedTest('at level 2', ({ level }) => {
              expect(level).toBe('two')
            })
          })

          extendedTest('still at level 1', ({ level }) => {
            expect(level).toBe('one')
          })
        })

        extendedTest('back to root', ({ level }) => {
          expect(level).toBe('root')
        })
      },
    })

    expect(stderr).toBe('')
    expect(tests).toMatchInlineSnapshot(`
      " ✓ basic.test.ts > root level <time>
       ✓ basic.test.ts > level 1 > at level 1 <time>
       ✓ basic.test.ts > level 1 > level 2 > at level 2 <time>
       ✓ basic.test.ts > level 1 > still at level 1 <time>
       ✓ basic.test.ts > back to root <time>"
    `)
  })

  test('override with function that accesses other static fixtures', async () => {
    const { stderr, tests } = await runFixtureTests(() => {
      return it
        .extend('basePort', 3000)
        .extend('environment', 'development')
        .extend('config', ({ basePort, environment }) => ({
          port: basePort,
          env: environment,
          debug: environment === 'development',
        }))
    }, {
      'basic.test.ts': ({ extendedTest, expect, describe }) => {
        extendedTest('default config', ({ config }) => {
          expect(config).toEqual({ port: 3000, env: 'development', debug: true })
        })

        describe('production', () => {
          // Chained overwrites
          extendedTest
            .override('environment', 'production')
            .override('basePort', 8080)

          extendedTest('production config', ({ config }) => {
            expect(config).toEqual({ port: 8080, env: 'production', debug: false })
          })
        })
      },
    })

    expect(stderr).toBe('')
    expect(tests).toMatchInlineSnapshot(`
      " ✓ basic.test.ts > default config <time>
       ✓ basic.test.ts > production > production config <time>"
    `)
  })

  test('throws an error when overriding worker fixtures inside a suite', async () => {
    const { stderr } = await runFixtureTests(() => {
      return it
        .extend('basePort', { scope: 'worker' }, () => 3000)
        .extend('environment', { scope: 'worker' }, 'development')
        .extend('config', { scope: 'worker' }, ({ basePort, environment }) => ({
          port: basePort,
          env: environment,
          debug: environment === 'development',
        }))
    }, {
      'basic.test.ts': ({ extendedTest, expect, describe }) => {
        extendedTest('default config', ({ config }) => {
          expect(config).toEqual({ port: 3000, env: 'development', debug: true })
        })

        describe('production', () => {
          // Chained overwrites
          extendedTest
            .override('environment', 'production') // scope automatically inherited
            .override('basePort', () => 8080)

          extendedTest('production config', ({ config }) => {
            expect(config).toEqual({ port: 8080, env: 'production', debug: false })
          })
        })
      },
    })

    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  basic.test.ts [ basic.test.ts ]
      FixtureDependencyError: The "environment" fixture cannot be defined with a worker scope (inherited from the base fixture) inside the describe block. Define it at the top level of the file instead.
       ❯ basic.test.ts:8:18
            6|   });
            7|   describe2("production", () => {
            8|     extendedTest.override("environment", "production").override("baseP…
             |                  ^
            9|     extendedTest("production config", ({ config }) => {
           10|       expect2(config).toEqual({ port: 8080, env: "production", debug: …

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  })

  test('throws an error when overriding file fixtures inside a describe', async () => {
    const { stderr } = await runFixtureTests(() => {
      return it
        .extend('basePort', { scope: 'file' }, () => 3000)
        .extend('environment', { scope: 'file' }, 'development')
        .extend('config', { scope: 'file' }, ({ basePort, environment }) => ({
          port: basePort,
          env: environment,
          debug: environment === 'development',
        }))
    }, {
      'basic.test.ts': ({ extendedTest, expect, describe }) => {
        extendedTest('default config', ({ config }) => {
          expect(config).toEqual({ port: 3000, env: 'development', debug: true })
        })

        describe('production', () => {
          // Chained overwrites
          extendedTest
            .override('environment', { scope: 'file' }, 'production')
            .override('basePort', { scope: 'file' }, () => 8080)

          extendedTest('production config', ({ config }) => {
            expect(config).toEqual({ port: 8080, env: 'production', debug: false })
          })
        })
      },
    })

    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  basic.test.ts [ basic.test.ts ]
      FixtureDependencyError: The "environment" fixture cannot be defined with a file scope inside the describe block. Define it at the top level of the file instead.
       ❯ basic.test.ts:8:18
            6|   });
            7|   describe2("production", () => {
            8|     extendedTest.override("environment", { scope: "file" }, "productio…
             |                  ^
            9|     extendedTest("production config", ({ config }) => {
           10|       expect2(config).toEqual({ port: 8080, env: "production", debug: …

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  })

  test('top-level override without nested suites', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => {
      return it
        .extend('staticValue', 'original-static')
        .extend('functionValue', () => 'original-function')
        .extend('asyncValue', async ({}, { onCleanup }) => {
          log('async setup')
          onCleanup(() => log('async cleanup'))
          return 'original-async'
        })
        .extend('fileScoped', { scope: 'file' }, () => 'original-file')
        .extend('workerScoped', { scope: 'worker' }, () => 'original-worker')
    }, {
      'basic.test.ts': ({ extendedTest, expect }) => {
        // Override at top level (no describe)
        extendedTest
          .override('staticValue', 'overridden-static')
          .override('functionValue', () => 'overridden-function')
          .override('asyncValue', async ({}, { onCleanup }) => {
            console.log('>> fixture | overridden async setup |', expect.getState().currentTestName)
            onCleanup(() => console.log('>> fixture | overridden async cleanup |', expect.getState().currentTestName))
            return 'overridden-async'
          })
          .override('fileScoped', { scope: 'file' }, () => 'overridden-file')
          .override('workerScoped', { scope: 'worker' }, () => 'overridden-worker')

        extendedTest('all fixtures are overridden', ({ staticValue, functionValue, asyncValue, fileScoped, workerScoped }) => {
          expect(staticValue).toBe('overridden-static')
          expect(functionValue).toBe('overridden-function')
          expect(asyncValue).toBe('overridden-async')
          expect(fileScoped).toBe('overridden-file')
          expect(workerScoped).toBe('overridden-worker')
        })

        extendedTest('second test uses same overrides', ({ staticValue, functionValue, asyncValue }) => {
          expect(staticValue).toBe('overridden-static')
          expect(functionValue).toBe('overridden-function')
          expect(asyncValue).toBe('overridden-async')
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | overridden async setup | all fixtures are overridden
      >> fixture | overridden async cleanup | all fixtures are overridden
      >> fixture | overridden async setup | second test uses same overrides
      >> fixture | overridden async cleanup | second test uses same overrides"
    `)
    expect(tests).toMatchInlineSnapshot(`
      " ✓ basic.test.ts > all fixtures are overridden <time>
       ✓ basic.test.ts > second test uses same overrides <time>"
    `)
  })

  test('top-level override with nested suites', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => {
      return it
        .extend('staticValue', 'original-static')
        .extend('functionValue', () => 'original-function')
        .extend('asyncValue', async ({}, { onCleanup }) => {
          log('async setup')
          onCleanup(() => log('async cleanup'))
          return 'original-async'
        })
        .extend('fileScoped', { scope: 'file' }, () => 'original-file')
        .extend('workerScoped', { scope: 'worker' }, () => 'original-worker')
    }, {
      'basic.test.ts': ({ extendedTest, expect, describe }) => {
        // Override at top level
        extendedTest
          .override('staticValue', 'top-static')
          .override('functionValue', () => 'top-function')
          .override('asyncValue', async ({}, { onCleanup }) => {
            console.log('>> fixture | top async setup |', expect.getState().currentTestName)
            onCleanup(() => console.log('>> fixture | top async cleanup |', expect.getState().currentTestName))
            return 'top-async'
          })
          .override('fileScoped', { scope: 'file' }, () => 'top-file')
          .override('workerScoped', { scope: 'worker' }, () => 'top-worker')

        extendedTest('top level uses overrides', ({ staticValue, functionValue, asyncValue, fileScoped, workerScoped }) => {
          expect(staticValue).toBe('top-static')
          expect(functionValue).toBe('top-function')
          expect(asyncValue).toBe('top-async')
          expect(fileScoped).toBe('top-file')
          expect(workerScoped).toBe('top-worker')
        })

        describe('nested suite', () => {
          // Override only static and function fixtures inside describe
          extendedTest
            .override('staticValue', 'nested-static')
            .override('functionValue', () => 'nested-function')

          extendedTest('nested uses mixed overrides', ({ staticValue, functionValue, asyncValue }) => {
            expect(staticValue).toBe('nested-static')
            expect(functionValue).toBe('nested-function')
            // asyncValue still uses top-level override
            expect(asyncValue).toBe('top-async')
          })

          describe('deeply nested suite', () => {
            extendedTest.override('staticValue', 'deep-static')

            extendedTest('deeply nested override', ({ staticValue, functionValue }) => {
              expect(staticValue).toBe('deep-static')
              expect(functionValue).toBe('nested-function')
            })
          })
        })

        extendedTest('back at top level', ({ staticValue, functionValue, asyncValue }) => {
          expect(staticValue).toBe('top-static')
          expect(functionValue).toBe('top-function')
          expect(asyncValue).toBe('top-async')
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | top async setup | top level uses overrides
      >> fixture | top async cleanup | top level uses overrides
      >> fixture | top async setup | nested suite > nested uses mixed overrides
      >> fixture | top async cleanup | nested suite > nested uses mixed overrides
      >> fixture | top async setup | back at top level
      >> fixture | top async cleanup | back at top level"
    `)
    expect(tests).toMatchInlineSnapshot(`
      " ✓ basic.test.ts > top level uses overrides <time>
       ✓ basic.test.ts > nested suite > nested uses mixed overrides <time>
       ✓ basic.test.ts > nested suite > deeply nested suite > deeply nested override <time>
       ✓ basic.test.ts > back at top level <time>"
    `)
  })

  test('top-level override with dependency chain', async () => {
    const { stderr, fixtures, tests } = await runFixtureTests(({ log }) => {
      return it
        .extend('basePort', 3000)
        .extend('config', ({ basePort }) => ({ port: basePort, host: 'localhost' }))
        .extend('server', async ({ config }, { onCleanup }) => {
          log('server start', config.port)
          onCleanup(() => log('server stop'))
          return { url: `http://${config.host}:${config.port}`, running: true }
        })
    }, {
      'basic.test.ts': ({ extendedTest, expect, describe }) => {
        // Override at top level
        extendedTest.override('basePort', 8080)

        extendedTest('top level uses overridden port', ({ config, server }) => {
          expect(config.port).toBe(8080)
          expect(server.url).toBe('http://localhost:8080')
        })

        describe('with custom host', () => {
          extendedTest.override('config', ({ basePort }) => ({ port: basePort, host: '0.0.0.0' }))

          extendedTest('nested uses custom host with top-level port', ({ config, server }) => {
            expect(config.port).toBe(8080)
            expect(config.host).toBe('0.0.0.0')
            expect(server.url).toBe('http://0.0.0.0:8080')
          })
        })
      },
    })

    expect(stderr).toBe('')
    expect(fixtures).toMatchInlineSnapshot(`
      ">> fixture | server start 8080 | top level uses overridden port
      >> fixture | server stop | top level uses overridden port
      >> fixture | server start 8080 | with custom host > nested uses custom host with top-level port
      >> fixture | server stop | with custom host > nested uses custom host with top-level port"
    `)
    expect(tests).toMatchInlineSnapshot(`
      " ✓ basic.test.ts > top level uses overridden port <time>
       ✓ basic.test.ts > with custom host > nested uses custom host with top-level port <time>"
    `)
  })
})

async function runFixtureTests<T>(
  extendedTest: ({ log, expectTypeOf }: { log: typeof console.log; expectTypeOf: typeof ExpectTypeOfFn }) => TestAPI<T>,
  fs: Record<string, ((context: {
    extendedTest: TestAPI<T>
    expect: ExpectStatic
    expectTypeOf: typeof ExpectTypeOfFn
    describe: SuiteAPI
    beforeAll: typeof beforeAll
    afterAll: typeof afterAll
  }) => unknown) | ViteUserConfig>,
  config?: TestUserConfig,
) {
  if (typeof fs['vitest.config.js'] === 'object') {
    fs['vitest.config.js'].test!.globals = true
  }
  const { stderr, stdout, fs: FS } = await runInlineTests({
    'test.js': `
export const describe = globalThis.describe
export const expect = globalThis.expect
export const expectTypeOf = globalThis.expectTypeOf
export const extendedTest = (${stripIndent(extendedTest.toString())})({ log: (...args) => console.log('>> fixture |', ...args, '| ' + expect.getState().currentTestName), expectTypeOf })
export const beforeAll = globalThis.beforeAll
export const afterAll = globalThis.afterAll
    `,
    'vitest.config.js': { test: { globals: true } },
    ...Object.entries(fs).reduce((acc, [key, value]) => {
      if (typeof value === 'object' && !Array.isArray(value)) {
        acc[key] = value
      }
      if (typeof value === 'function') {
        acc[key] = [value, { imports: { './test.js': ['extendedTest', 'expect', 'expectTypeOf', 'describe', 'beforeAll', 'afterAll'] } }]
      }
      return acc
    }, {} as TestFsStructure),
  }, { ...config, sequence: { sequencer: StableTestFileOrderSorter } })

  return {
    stderr,
    stdout,
    fixtures: getFixtureLogs(stdout),
    tests: getSuccessTests(stdout),
    fs: FS,
  }
}

function getSuccessTests(stdout: string) {
  return stdout
    .split('\n')
    .filter(f => f.startsWith(' ✓ '))
    .map(f => f.replace(/\d+ms/, '<time>'))
    .join('\n')
}

function getFixtureLogs(stdout: string) {
  return stdout
    .split('\n')
    .filter(f => f.startsWith('>> fixture |'))
    .join('\n')
}

class StableTestFileOrderSorter {
  sort(files: TestSpecification[]) {
    return files.sort((a, b) => a.moduleId.localeCompare(b.moduleId))
  }

  shard(files: TestSpecification[]) {
    return files
  }
}
