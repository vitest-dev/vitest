import fs from 'node:fs'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('compare', { timeout: 60_000 }, async () => {
  await fs.promises.rm('./fixtures/compare/bench.json', { force: true })

  // --outputJson
  {
    const result = await runVitest({
      root: './fixtures/compare',
      outputJson: './bench.json',
      reporters: ['default'],
    }, [], 'benchmark')
    expect(result.exitCode).toBe(0)
    expect(fs.existsSync('./fixtures/compare/bench.json')).toBe(true)
  }

  // --compare
  {
    const result = await runVitest({
      root: './fixtures/compare',
      compare: './bench.json',
      reporters: ['default'],
    }, [], 'benchmark')
    expect(result.exitCode).toBe(0)
    const lines = result.stdout.split('\n').slice(4).slice(0, 6)
    const expected = `
✓ basic.bench.ts > suite
    name
  · sleep10
             (baseline)
  · sleep100
             (baseline)
  `

    for (const [index, line] of expected.trim().split('\n').entries()) {
      expect(lines[index]).toMatch(line.trim())
    }
  }
})
