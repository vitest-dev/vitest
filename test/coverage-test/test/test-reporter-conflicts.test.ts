import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect } from 'vitest'
import { runVitest, test } from '../utils'

test('coverage provider does not conflict with built-in reporter\'s outputFile (#3330)', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts'],
    coverage: { reporter: ['html'], all: false },
    reporters: ['default', 'junit'],
    outputFile: { junit: 'coverage/junit.xml' },
  })

  const coveragePath = resolve('./coverage')
  const files = readdirSync(coveragePath)

  expect(files).toContain('index.html')
  expect(files).toContain('junit.xml')
  expect(files).toContain('math.ts.html')
})
