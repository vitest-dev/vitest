import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect } from 'vitest'
import { sum } from '../fixtures/src/math'
import { coverageTest, normalizeURL, runVitest, test } from '../utils'

test('custom reporter (ESM)', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      reporter: [
        [resolve('fixtures/custom-reporter.mjs'), { file: 'custom-reporter-output-mjs.md' }],
      ],
    },
  })

  const coveragePath = resolve('./coverage')
  const files = readdirSync(coveragePath)

  expect(files).toContain('custom-reporter-output-mjs.md')

  const content = readFileSync(resolve(coveragePath, 'custom-reporter-output-mjs.md'), 'utf-8')
  expect(content).toMatchInlineSnapshot(`
    "Start of custom coverage report ESM
    End of custom coverage report ESM
    "
  `)
})

coverageTest('cover some lines', () => {
  expect(sum(2, 5)).toBe(7)
})

test('custom reporter (CJS)', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      reporter: [
        [resolve('fixtures/custom-reporter.cjs'), { file: 'custom-reporter-output-cjs.md' }],
      ],
    },
  })

  const coveragePath = resolve('./coverage')
  const files = readdirSync(coveragePath)

  expect(files).toContain('custom-reporter-output-cjs.md')

  const content = readFileSync(resolve(coveragePath, 'custom-reporter-output-cjs.md'), 'utf-8')
  expect(content).toMatchInlineSnapshot(`
    "Start of custom coverage report CJS
    End of custom coverage report CJS
    "
  `)
})

coverageTest('cover some lines', () => {
  expect(sum(2, 5)).toBe(7)
})
