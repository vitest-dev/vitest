import type { CoverageOptions } from 'vitest/node'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { configDefaults } from 'vitest/config'
import { resolveConfig } from 'vitest/node'

test('resolves the test config', async () => {
  const viteConfig = await resolveConfig()
  expect(viteConfig.mode).toBe('test')
  expect(viteConfig.test.mode).toBe('test')
  // inherits the root config
  // TODO: test cwd loading behavior without relying on test/e2e/vitest.config.ts
  expect(viteConfig.test.reporters.slice(0, 1)).toEqual([[process.env.CI ? 'minimal' : 'verbose', {}]])
  expect(viteConfig.plugins.find(p => p.name === 'vitest:config')).toBeDefined()
})

test('applies custom options', async () => {
  const viteConfig = await resolveConfig({
    mode: 'development',
    setupFiles: ['/test/setup.ts'],
  })
  expect(viteConfig.mode).toBe('development')
  expect(viteConfig.test.mode).toBe('development')
  expect(viteConfig.test.setupFiles).toEqual(['/test/setup.ts'])
  expect(viteConfig.plugins.find(p => p.name === 'vitest:config')).toBeDefined()
})

test('respects root', async () => {
  process.env.GITHUB_ACTIONS = 'false'
  const configRoot = resolve(import.meta.dirname, '../fixtures/public-config')
  const viteConfig = await resolveConfig({
    root: configRoot,
  })
  expect(viteConfig.configFile).toBe(resolve(configRoot, 'vitest.config.ts'))
  expect(viteConfig.test.name).toBe('root config')
  expect(viteConfig.test.reporters).toEqual(configDefaults.reporters.map(v => [v, {}]))
})

test('respects custom config', async () => {
  process.env.GITHUB_ACTIONS = 'false'
  const config = resolve(import.meta.dirname, '../fixtures/public-config/vitest.custom.config.ts')
  const viteConfig = await resolveConfig({
    config,
  })
  expect(viteConfig.configFile).toBe(config)
  expect(viteConfig.test.name).toBe('custom config')
  expect(viteConfig.test.reporters).toEqual(configDefaults.reporters.map(v => [v, {}]))
})

test('default value changes of coverage.exclude do not reflect to test.exclude', async () => {
  const exclude = ['**/custom-exclude/**']

  const viteConfig = await resolveConfig({
    include: ['**/example.test.ts'],
    exclude,
    coverage: {
      exclude,
    },
  })

  expect(exclude).toStrictEqual(['**/custom-exclude/**'])

  expect(viteConfig.test.include).toStrictEqual(['**/example.test.ts'])
  expect(viteConfig.test.exclude).toStrictEqual(['**/custom-exclude/**'])

  expect(viteConfig.test.coverage.exclude).toContain('**/custom-exclude/**')
  expect(viteConfig.test.coverage.exclude).toContain('**/example.test.ts')
})

test.for([
  {
    options: {},
    expected: 'coverage',
  },
  {
    options: { reporter: ['html'] },
    expected: 'coverage',
  },
  {
    options: { reporter: [['html', {}]] },
    expected: 'coverage',
  },
  {
    options: { reporter: [['html-spa', {}]] },
    expected: 'coverage',
  },
  {
    options: { reporter: [['html', { subdir: 'custom-subdir' }]] },
    expected: 'coverage/custom-subdir',
  },
  {
    options: { reporter: [['html', {}]], reportsDirectory: 'my-coverage' },
    expected: 'my-coverage',
  },
  {
    options: { reporter: [['html', { subdir: 'custom-subdir' }]], reportsDirectory: 'my-coverage' },
    expected: 'my-coverage/custom-subdir',
  },
  {
    options: { reporter: ['lcov'] },
    expected: 'coverage/lcov-report',
  },
  {
    options: { reporter: [['text', {}]] },
    expected: undefined,
  },
  {
    options: { htmlDir: 'custom-html-dir' },
    expected: 'custom-html-dir',
  },
] satisfies {
  options: CoverageOptions
  expected?: string
}[])('coverage.htmlDir inference: $options', async ({ options, expected }) => {
  const viteConfig = await resolveConfig({
    config: false,
    coverage: { enabled: true, ...options },
  })
  expect(viteConfig.test.coverage.htmlDir).toBe(
    expected && resolve(viteConfig.test.root, expected),
  )
})

test('coverage.changed inherits from test.changed but can be overridden', async () => {
  const { test: inherited } = await resolveConfig({
    changed: 'HEAD',
    coverage: {
      reporter: 'json',
    },
  })

  expect(inherited.coverage.changed).toBe('HEAD')

  const { test: overridden } = await resolveConfig({
    changed: 'HEAD',
    coverage: {
      changed: false,
    },
  })

  expect(overridden.coverage.changed).toBe(false)
})
