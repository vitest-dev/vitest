import { runVitest } from '#test-utils'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'

test('custom diff config', async () => {
  const filename = resolve('./fixtures/reporters/custom-diff-config.test.ts')
  const diff = resolve('./fixtures/reporters/custom-diff-config.ts')
  const { stderr } = await runVitest({ root: './fixtures/reporters', diff }, [filename])

  expect(stderr).toBeTruthy()
  expect(stderr).toContain('Expected to be')
  expect(stderr).toContain('But got')
})

test('invalid diff config file', async () => {
  const filename = resolve('./fixtures/reporters/custom-diff-config.test.ts')
  const diff = resolve('./fixtures/reporters/invalid-diff-config.ts')
  const { stderr } = await runVitest({ root: './fixtures/reporters', diff }, [filename])

  expect(stderr).toBeTruthy()
  expect(stderr).toContain('invalid diff config file')
  expect(stderr).toContain('Must have a default export with config object')
})
