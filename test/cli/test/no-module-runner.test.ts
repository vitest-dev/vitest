import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test.skip('cannot run viteModuleRunner: false in "vmForks"', async () => {
  const { stderr } = await runInlineTests({
    'base.test.js': ``,
    'vitest.config.js': {
      test: {
        pool: 'vmForks',
        experimental: {
          viteModuleRunner: false,
        },
      },
    },
  })

  expect(stderr).toContain(`Pool "vmForks" cannot run with "experimental.viteModuleRunner: false". Please, use "threads" or "forks" instead.`)
})

test.skip('cannot run viteModuleRunner: false in "vmThreads"', async () => {
  const { stderr } = await runInlineTests({
    'base.test.js': ``,
    'vitest.config.js': {
      test: {
        pool: 'vmThreads',
        experimental: {
          viteModuleRunner: false,
        },
      },
    },
  })

  expect(stderr).toContain(`Pool "vmThreads" cannot run with "experimental.viteModuleRunner: false". Please, use "threads" or "forks" instead.`)
})

test('can run tests in threads worker', async () => {
  const { stderr, testTree } = await runInlineTests({
    'base1.test.js': `
test('hello world', () => {})
    `,
    'base2.test.js': `
test('hello world', () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        pool: 'threads',
        experimental: {
          viteModuleRunner: false,
        },
      },
    },
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "base1.test.js": {
        "hello world": "passed",
      },
      "base2.test.js": {
        "hello world": "passed",
      },
    }
  `)
})

test('can run tests in forks worker', async () => {
  const { stderr, testTree } = await runInlineTests({
    'base1.test.js': `
test('hello world', () => {})
    `,
    'base2.test.js': `
test('hello world', () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        pool: 'forks',
        experimental: {
          viteModuleRunner: false,
        },
      },
    },
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "base1.test.js": {
        "hello world": "passed",
      },
      "base2.test.js": {
        "hello world": "passed",
      },
    }
  `)
})

test('ESM files don\'t have access to CJS globals', async () => {
  const { stderr, testTree } = await runInlineTests({
    'base.test.js': `
test('no globals', () => {
  expect(typeof __dirname).toBe('undefined')
  expect(typeof __filename).toBe('undefined')
  expect(typeof exports).toBe('undefined')
  expect(typeof module).toBe('undefined')
})

test('no vite globals', () => {
  expect(typeof import.meta).toBe('object')
  expect(typeof import.meta.env).toBe('undefined')
})
    `,
    'package.json': JSON.stringify({
      name: '@test/no-globals-cjs-esm-native-module-runner',
      type: 'module',
    }),
    'vitest.config.js': {
      test: {
        globals: true,
        experimental: {
          viteModuleRunner: false,
        },
      },
    },
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "base.test.js": {
        "no globals": "passed",
        "no vite globals": "passed",
      },
    }
  `)
})

test('CJS files don\'t have access to ESM globals', async () => {
  const { stderr, testTree } = await runInlineTests({
    'base.test.js': `
test('has CJS globals', () => {
  expect(typeof __dirname).toBe('string')
  expect(typeof __filename).toBe('string')
  expect(typeof exports).toBe('object')
  expect(typeof module).toBe('object')
})
    `,
    'esm.test.js': `
test('no esm globals', () => {
  expect(typeof import.meta).toBe('undefined')
})
    `,
    'package.json': JSON.stringify({
      name: '@test/no-globals-esm-cjs-native-module-runner',
      type: 'commonjs',
    }),
    'vitest.config.js': {
      test: {
        globals: true,
        experimental: {
          viteModuleRunner: false,
        },
      },
    },
  })

  expect(stderr).toContain('Cannot use \'import.meta\' outside a module')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "base.test.js": {
        "has CJS globals": "passed",
      },
      "esm.test.js": {},
    }
  `)
})

// TODO: test that in-souce is imported by another test and doesn't run there
test('in-source tests in CJS work', async () => {
  const { stderr, testTree } = await runInlineTests({
    'in-source.js': `
if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest
  test('works', () => {
    expect(import.meta.vitest).toBeDefined()
  })
}
    `,
    'package.json': JSON.stringify({
      name: '@test/no-globals-esm-cjs-native-module-runner',
      type: 'commonjs',
    }),
    'vitest.config.js': {
      test: {
        globals: true,
        includeSource: ['./in-source.js'],
        experimental: {
          viteModuleRunner: false,
        },
      },
    },
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "in-source.js": {
        "works": "passed",
      },
    }
  `)
})

test('in-source tests in ESM work', async () => {
  const { stderr, testTree } = await runInlineTests({
    'in-source.js': `
if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest
  test('works', () => {
    expect(import.meta.vitest).toBeDefined()
  })
}
    `,
    'package.json': JSON.stringify({
      name: '@test/no-globals-cjs-esm-native-module-runner',
      type: 'module',
    }),
    'vitest.config.js': {
      test: {
        globals: true,
        includeSource: ['./in-source.js'],
        experimental: {
          viteModuleRunner: false,
        },
      },
    },
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "in-source.js": {
        "works": "passed",
      },
    }
  `)
})

test.runIf(process.features.typescript)('an error in in-source tests is shown correctly', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'in-source.ts': `
interface HelloWorld {
  isStripped: true
}

if (import.meta.vitest) {
  const {
    test,
    expect
  } = import.meta.vitest

  test('works', () => {
    throw new Error('test throws correctly')
  })
}
    `,
    'package.json': JSON.stringify({
      name: '@test/no-globals-cjs-esm-native-module-runner',
      type: 'module',
    }),
    'vitest.config.js': {
      test: {
        globals: true,
        includeTaskLocation: true,
        includeSource: ['./in-source.ts'],
        experimental: {
          viteModuleRunner: false,
        },
      },
    },
  })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  in-source.ts:12:3 > works
    Error: test throws correctly
     ❯ <anonymous> in-source.ts:13:11
         11| 
         12|   test('works', () => {
         13|     throw new Error('test throws correctly')
           |           ^
         14|   })
         15| }

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "in-source.ts": {
        "works": [
          "test throws correctly",
        ],
      },
    }
  `)
})
