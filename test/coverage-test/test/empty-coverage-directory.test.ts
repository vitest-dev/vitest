import { existsSync, readdirSync } from 'node:fs'
import { expect } from 'vitest'
import { coverageTest, normalizeURL, runVitest, test } from '../utils'
import { sum } from '../fixtures/src/math'

test('empty coverage directory is cleaned after tests', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: { reporter: 'text', all: false },
  })

  if (existsSync('./coverage')) {
    if (readdirSync('./coverage').length !== 0) {
      throw new Error('Test case expected coverage directory to be empty')
    }

    throw new Error('Empty coverage directory was not cleaned')
  }
})

coverageTest('cover some lines', () => {
  expect(sum(2, 3)).toBe(5)
})
