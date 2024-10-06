import { existsSync, readdirSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { expect } from 'vitest'
import { runVitest, test } from '../utils'

const include = ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts']

test('reporter as string', async () => {
  await runVitest({
    include,
    coverage: {
      reporter: 'json',
      all: false,
    },
  })

  const files = readdirSync('./coverage')
  expect(files).toContain('coverage-final.json')
})

test('reporter as string when coverage is disabled', async () => {
  if (existsSync('./coverage')) {
    await rm('./coverage', { recursive: true, force: true })
  }

  await runVitest({
    include,
    coverage: {
      enabled: false,
      reporter: 'json',
      all: false,
    },
  })

  expect(existsSync('./coverage')).toBe(false)
})

test('reporter as list of strings', async () => {
  await runVitest({
    include,
    coverage: {
      reporter: ['json', 'lcov'],
      all: false,
    },
  })

  const files = readdirSync('./coverage')
  expect(files).toContain('coverage-final.json')
  expect(files).toContain('lcov.info')
  expect(files).toContain('lcov-report')
})

test('reporter as list of lists', async () => {
  await runVitest({
    include,
    coverage: {
      reporter: [['json'], ['text', { file: 'custom-text-report' }]],
      all: false,
    },
  })

  const files = readdirSync('./coverage')
  expect(files).toContain('coverage-final.json')
  expect(files).toContain('custom-text-report')
})

test('all reporter variants mixed', async () => {
  await runVitest({
    include,
    coverage: {
      reporter: [
        'json',
        ['lcov'],
        ['text', { file: 'custom-text-report' }],
      ],
      all: false,
    },
  })

  const files = readdirSync('./coverage')
  expect(files).toContain('coverage-final.json')
  expect(files).toContain('lcov.info')
  expect(files).toContain('lcov-report')
  expect(files).toContain('custom-text-report')
})
