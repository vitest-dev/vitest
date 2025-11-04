import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { createVitest } from 'vitest/node'

test('can pass down the config as a module', async () => {
  const vitest = await createVitest('test', {
    config: '@test/test-dep-config',
  })

  expect(vitest.vite.config.configFile).toBe(
    resolve(import.meta.dirname, '../deps/test-dep-config/index.js'),
  )
})
