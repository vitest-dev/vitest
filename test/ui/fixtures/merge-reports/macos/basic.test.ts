import { test } from 'vitest'

test('ok', async ({ annotate }) => {
  await annotate(`test-${process.env.TEST_LABEL ?? "unknown"}`)
})
