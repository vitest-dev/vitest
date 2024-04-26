import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { startVitest } from 'vitest/node'

test('benchmark', async () => {
  await fs.promises.rm('fixtures/benchmark/bench.json', { force: true })
  await startVitest('benchmark', [], {
    watch: false,
    root: 'fixtures/benchmark',
    browser: { headless: true },
    benchmark: {
      reporters: ['json'],
      outputFile: 'bench.json',
    },
  })
  const benchJson = JSON.parse(await fs.promises.readFile('fixtures/benchmark/bench.json', 'utf-8'))
  assert.equal(benchJson.testResults['suite-a'][0].name, 'good')
})
