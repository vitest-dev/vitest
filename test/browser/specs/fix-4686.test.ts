// fix #4686

import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('tests run in presence of config.base', async () => {
  const { stderr, ctx } = await runBrowserTests(
    {
      config: './vitest.config-basepath.mts',
    },
    ['test/basic.test.ts'],
  )

  expect(stderr).toBe('')
  expect(
    Object.fromEntries(
      ctx.state.getFiles().map(f => [f.name, f.result.state]),
    ),
  ).toMatchInlineSnapshot(`
    {
      "test/basic.test.ts": "pass",
    }
  `)
})
