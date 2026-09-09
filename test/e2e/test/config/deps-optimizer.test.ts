import { expect, test } from 'vitest'
import { runInlineTests } from '../../../test-utils'

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
