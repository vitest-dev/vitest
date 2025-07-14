/// <reference types="vitest/globals" />

import type { TestAPI } from 'vitest'
import type { ViteUserConfig } from 'vitest/config'
import type { TestSpecification, TestUserConfig } from 'vitest/node'
import type { TestFsStructure } from '../../test-utils'
import { runInlineTests } from '../../test-utils'

interface TestContext {
  file: string
  worker: string
}

test('test fixture cannot import from file fixture', async () => {
  const { stderr } = await runInlineTests({
    'basic.test.ts': () => {
      const extendedTest = it.extend<{
        file: string
        local: string
      }>({
        local: ({}, use) => use('local'),
        file: [
          ({ local }, use) => use(local),
          { scope: 'file' },
        ],
      })

      extendedTest('not working', ({ file: _file }) => {})
    },
  }, { globals: true })
  expect(stderr).toContain('cannot use the test fixture "local" inside the file fixture "file"')
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
    'basic.test.ts': ({ extendedTest }) => {
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
  expect(stderr).toContain('cannot use the test fixture "local" inside the worker fixture "worker"')
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
  const { stderr, stdout } = await runInlineTests({
    'basic.test.ts': () => {
      const extendedTest = it.extend<{
        worker: string
        local: string
      }>({
        local: 'local',
        worker: [
          ({ local }, use) => use(local),
          { scope: 'worker' },
        ],
      })

      extendedTest('working', ({ worker, local }) => {
        expect(worker).toBe(local)
        expect(worker).toBe('local')
      })
    },
  }, { globals: true })
  expect(stdout).toContain('basic.test.ts')
  expect(stderr).toBe('')
})

test('file fixture can import a static value from test fixture', async () => {
  const { stderr, stdout } = await runInlineTests({
    'basic.test.ts': () => {
      const extendedTest = it.extend<{
        file: string
        local: string
      }>({
        local: 'local',
        file: [
          ({ local }, use) => use(local),
          { scope: 'file' },
        ],
      })

      extendedTest('working', ({ file, local }) => {
        expect(file).toBe(local)
        expect(file).toBe('local')
      })
    },
  }, { globals: true })
  expect(stdout).toContain('basic.test.ts')
  expect(stderr).toBe('')
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
      extendedTest('test1', ({ worker: _worker }) => {})
    },
  }, {
    globals: true,
    maxWorkers: 1,
    minWorkers: 1,
    pool: 'vmThreads',
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
    minWorkers: 2,
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
    minWorkers: 1,
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
      beforeEach<TestContext>(({ worker }) => {
        console.log('>> fixture | beforeEach |', worker)
      })
      afterEach<TestContext>(({ worker }) => {
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
      beforeEach<TestContext>(({ file }) => {
        console.log('>> fixture | beforeEach |', file)
      })
      afterEach<TestContext>(({ file }) => {
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
    'basic.test.js': ({ extendedTest }) => {
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

    'second.test.js': ({ extendedTest }) => {
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
      provider: 'playwright',
      headless: true,
      instances: [
        { browser: 'chromium', name: '' },
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
            provider: 'playwright',
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

async function runFixtureTests<T>(
  extendedTest: ({ log }: { log: typeof console.log }) => TestAPI<T>,
  fs: Record<string, ((context: { extendedTest: TestAPI<T> }) => unknown) | ViteUserConfig>,
  config?: TestUserConfig,
) {
  if (typeof fs['vitest.config.js'] === 'object') {
    fs['vitest.config.js'].test!.globals = true
  }
  const { stderr, stdout } = await runInlineTests({
    'test.js': `
    export const extendedTest = (${extendedTest.toString()})({ log: (...args) => console.log('>> fixture |', ...args, '| ' + expect.getState().currentTestName) })
    `,
    'vitest.config.js': { test: { globals: true } },
    ...Object.entries(fs).reduce((acc, [key, value]) => {
      if (typeof value === 'object' && !Array.isArray(value)) {
        acc[key] = value
      }
      if (typeof value === 'function') {
        acc[key] = [value, { imports: { './test.js': ['extendedTest'] } }]
      }
      return acc
    }, {} as TestFsStructure),
  }, { ...config, sequence: { sequencer: StableTestFileOrderSorter } })

  return {
    stderr,
    stdout,
    fixtures: getFixtureLogs(stdout),
    tests: getSuccessTests(stdout),
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
