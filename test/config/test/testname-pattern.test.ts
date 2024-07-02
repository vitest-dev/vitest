import { join, resolve } from 'pathe'
import { expect, test } from 'vitest'

import { runVitest } from '../../test-utils'

test.each([
  { filter: 'example' },
  { filter: '/example' },
  { filter: resolve('./fixtures/filters/test/example') },
])('match by partial pattern $filter', async ({ filter }) => {
  const { stdout } = await runVitest({ root: './fixtures/filters' }, [filter])

  expect(stdout).toMatch('✓ test/example.test.ts > this will pass')
  expect(stdout).toMatch('Test Files  1 passed (1)')
  expect(stdout).not.toMatch('test/config.test.ts')
})

test('match by full test file name', async () => {
  const filename = resolve('./fixtures/filters/test/example.test.ts')
  const { stdout } = await runVitest({ root: './fixtures/filters' }, [filename])

  expect(stdout).toMatch('✓ test/example.test.ts > this will pass')
  expect(stdout).toMatch('Test Files  1 passed (1)')
  expect(stdout).not.toMatch('test/filters.test.ts')
})

test('match by pattern that also matches current working directory', async () => {
  const filter = 'config'
  expect(process.cwd()).toMatch(filter)

  const { stdout } = await runVitest({ root: './fixtures/filters' }, [filter])

  expect(stdout).toMatch('✓ test/config.test.ts > this will pass')
  expect(stdout).toMatch('Test Files  1 passed (1)')
  expect(stdout).not.toMatch('test/example.test.ts')
})

test.each([
  ['the parent of CWD', resolve(process.cwd(), '..')],
  ['the parent of CWD with slash', join(resolve(process.cwd(), '..'), '/')],
  ['the parent of a parent of CWD', resolve(process.cwd(), '..', '..')],
])('match by pattern that also matches %s: %s', async (_, filter) => {
  const { stdout } = await runVitest({ root: './fixtures/filters' }, [filter])

  expect(stdout).toMatch('✓ test/config.test.ts > this will pass')
  expect(stdout).toMatch('× test/dont-run-this.test.ts > this will fail')
  expect(stdout).toMatch('✓ test/example.test.ts > this will pass')
})

test.each([
  {
    filter: 'basic',
    files: [
      'test/basic.test.ts',
      'test/foo-basic/a.test.ts',
      'test/basic/a.test.ts',
      'test/basic-foo/a.test.ts',
    ],
  },
  {
    filter: '/basic',
    files: [
      'test/basic.test.ts',
      'test/basic/a.test.ts',
      'test/basic-foo/a.test.ts',
    ],
  },
  {
    filter: 'basic/',
    files: [
      'test/foo-basic/a.test.ts',
      'test/basic/a.test.ts',
    ],
  },
  {
    filter: '/basic/',
    files: [
      'test/basic/a.test.ts',
    ],
  },
])('filter with slash $filter', async ({ filter, files }) => {
  const { stdout } = await runVitest({ root: './fixtures/filters-slash' }, [filter])
  expect(stdout).toMatch(`Test Files  ${files.length} passed (${files.length})`)
  for (const file of files) {
    expect(stdout).toMatch(`✓ ${file}`)
  }
})
