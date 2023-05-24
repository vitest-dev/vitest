import { resolve } from 'pathe'
import { expect, test } from 'vitest'

import { runVitest } from '../../test-utils'

test('match by partial pattern', async () => {
  const { stdout } = await runVitest({ root: './fixtures' }, ['example'])

  expect(stdout).toMatch('✓ test/example.test.ts > this will pass')
  expect(stdout).toMatch('Test Files  1 passed (1)')
  expect(stdout).not.toMatch('test/filters.test.ts')
})

test('match by full test file name', async () => {
  const filename = resolve('./fixtures/test/example.test.ts')
  const { stdout } = await runVitest({ root: './fixtures' }, [filename])

  expect(stdout).toMatch('✓ test/example.test.ts > this will pass')
  expect(stdout).toMatch('Test Files  1 passed (1)')
  expect(stdout).not.toMatch('test/filters.test.ts')
})

test('match by pattern that also matches current working directory', async () => {
  const filter = 'filters'
  expect(process.cwd()).toMatch(filter)

  const { stdout } = await runVitest({ root: './fixtures' }, [filter])

  expect(stdout).toMatch('✓ test/filters.test.ts > this will pass')
  expect(stdout).toMatch('Test Files  1 passed (1)')
  expect(stdout).not.toMatch('test/example.test.ts')
})
