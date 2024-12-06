import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { resolveConfig } from 'vitest/node'

test('resolves the test config', async () => {
  const { viteConfig, vitestConfig } = await resolveConfig()
  expect(viteConfig.mode).toBe('test')
  expect(vitestConfig.mode).toBe('test')
  expect(vitestConfig.reporters).toEqual([['verbose', {}]]) // inherits the root config
  expect(viteConfig.plugins.find(p => p.name === 'vitest')).toBeDefined()
})

test('applies custom options', async () => {
  const { viteConfig, vitestConfig } = await resolveConfig({
    mode: 'development',
    setupFiles: ['/test/setup.ts'],
  })
  expect(viteConfig.mode).toBe('development')
  expect(vitestConfig.mode).toBe('test') // vitest mode is "test" or "benchmark"
  expect(vitestConfig.setupFiles).toEqual(['/test/setup.ts'])
  expect(viteConfig.plugins.find(p => p.name === 'vitest')).toBeDefined()
})

test('respects root', async () => {
  process.env.GITHUB_ACTIONS = 'false'
  const configRoot = resolve(import.meta.dirname, '../fixtures/public-config')
  const { viteConfig, vitestConfig } = await resolveConfig({
    root: configRoot,
  })
  expect(viteConfig.configFile).toBe(resolve(configRoot, 'vitest.config.ts'))
  expect(vitestConfig.name).toBe('root config')
  expect(vitestConfig.reporters).toEqual([['default', {}]])
})

test('respects custom config', async () => {
  process.env.GITHUB_ACTIONS = 'false'
  const config = resolve(import.meta.dirname, '../fixtures/public-config/vitest.custom.config.ts')
  const { viteConfig, vitestConfig } = await resolveConfig({
    config,
  })
  expect(viteConfig.configFile).toBe(config)
  expect(vitestConfig.name).toBe('custom config')
  expect(vitestConfig.reporters).toEqual([['default', {}]])
})
