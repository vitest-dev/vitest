import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect } from 'vitest'
import { sum } from '../fixtures/src/math'
import { coverageTest, normalizeURL, runVitest, test } from '../utils'

test('custom reporter', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      reporter: [
        [resolve('fixtures/custom-reporter.cjs'), { file: 'custom-reporter-output.md' }],
      ],
    },
  })

  const coveragePath = resolve('./coverage')
  const files = readdirSync(coveragePath)

  expect(files).toContain('custom-reporter-output.md')

  const content = readFileSync(resolve(coveragePath, 'custom-reporter-output.md'), 'utf-8')
  expect(content).toMatchInlineSnapshot(`
    "Start of custom coverage report
    End of custom coverage report
    "
  `)
})

coverageTest('cover some lines', () => {
  expect(sum(2, 5)).toBe(7)
})
