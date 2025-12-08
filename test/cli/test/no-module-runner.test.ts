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
test('hello world', () => {
  //
})
    `,
    'base2.test.js': `
test('hello world', () => {
  //
})
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
test('hello world', () => {
  //
})
    `,
    'base2.test.js': `
test('hello world', () => {
  //
})
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
