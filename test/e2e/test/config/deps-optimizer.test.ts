import { expect, test } from 'vitest'
import { resolveTestConfig, runInlineTests } from '../../../test-utils'

test('deps.optimizer.web is deprecated in favour of deps.optimizer.client', async () => {
  const { stderr } = await runInlineTests(
    { 'basic.test.ts': 'test("passes", () => {})' },
    {
      deps: {
        optimizer: {
          web: { enabled: true },
        },
      },
    },
  )
  expect(stderr).toContain('`deps.optimizer.web` is deprecated')
  expect(stderr).toContain('Use `deps.optimizer.client` instead')
})

test('deps.optimizer.client is not deprecated', async () => {
  const { stderr } = await runInlineTests(
    { 'basic.test.ts': 'test("passes", () => {})' },
    {
      deps: {
        optimizer: {
          client: { enabled: false },
        },
      },
    },
  )
  expect(stderr).not.toContain('`deps.optimizer.web` is deprecated')
})

test('deps.optimizer.web is deprecated only without a `web` environment', async () => {
  // `deps.optimizer` is keyed by Vite environment name, so `web` is a valid key
  // when the user declares that environment themselves - only the Vitest 3
  // alias for `client` is silently ignored
  const web = { enabled: true }

  const withoutEnvironment = await resolveTestConfig({
    deps: {
      optimizer: { web },
    },
  })
  expect(withoutEnvironment.stderr).toContain('`deps.optimizer.web` is deprecated')

  const withEnvironment = await resolveTestConfig({
    deps: {
      optimizer: { web },
    },
    $viteConfig: {
      environments: {
        web: {},
      },
    },
  })
  expect(withEnvironment.stderr).not.toContain('`deps.optimizer.web` is deprecated')
})
