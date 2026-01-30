/* eslint-disable */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Configuration - adjust these to vary the benchmark
const FILE_COUNT = Number.parseInt(process.env.FILE_COUNT || '100', 10)
const TESTS_PER_FILE = Number.parseInt(process.env.TESTS_PER_FILE || '100', 10)

const testsDir = join(import.meta.dirname, 'tests')

// Clean and recreate tests directory
if (existsSync(testsDir)) {
  rmSync(testsDir, { recursive: true })
}
mkdirSync(testsDir, { recursive: true })

console.log(`Generating ${FILE_COUNT} test files with ${TESTS_PER_FILE} tests each...`)
console.log(`Total tests: ${FILE_COUNT * TESTS_PER_FILE}`)

for (let i = 0; i < FILE_COUNT; i++) {
  const tests = Array.from(
    { length: TESTS_PER_FILE },
    (_, j) => `
  it('test-${j}', () => {
    expect(${i + j}).toBe(${i + j})
  })`,
  ).join('\n')

  const content = `import { describe, it, expect } from 'vitest'

describe('suite-${i}', () => {${tests}
})
`
  writeFileSync(join(testsDir, `test-${i}.test.ts`), content)
}

console.log(`Generated ${FILE_COUNT} test files in ${testsDir}`)
