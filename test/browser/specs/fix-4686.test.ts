// fix #4686

import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('tests run in presence of config.base', async () => {
  const { stderr, stdout } = await runBrowserTests(
    {
      config: './vitest.config-basepath.mts',
    },
    ['test/basic.test.ts'],
  )

  expect(stderr).toBe('')

  instances.forEach(({ browser }) => {
    expect(stdout).toContain(`✓ |${browser}| test/basic.test.ts`)
  })
})
