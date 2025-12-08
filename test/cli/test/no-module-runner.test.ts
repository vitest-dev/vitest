import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('cannot run viteModuleRunner: false in "vmForks"', async () => {
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

test('cannot run viteModuleRunner: false in "vmThreads"', async () => {
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
