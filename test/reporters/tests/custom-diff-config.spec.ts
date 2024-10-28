import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('custom diff config', async () => {
  const filename = resolve('./fixtures/custom-diff-config.test.ts')
  const diff = resolve('./fixtures/custom-diff-config.ts')
  const { stderr } = await runVitest({ root: './fixtures', diff }, [filename])

  expect(stderr).toBeTruthy()
  expect(stderr).toContain('Expected to be')
  expect(stderr).toContain('But got')
})

test('invalid diff config file', async () => {
  const filename = resolve('./fixtures/custom-diff-config.test.ts')
  const diff = resolve('./fixtures/invalid-diff-config.ts')
  const { stderr } = await runVitest({ root: './fixtures', diff }, [filename])

  expect(stderr).toBeTruthy()
  expect(stderr).toContain('invalid diff config file')
  expect(stderr).toContain('Must have a default export with config object')
})
