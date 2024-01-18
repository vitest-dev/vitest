import { existsSync, rmSync } from 'node:fs'
import * as assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { startVitest } from 'vitest/node'

if (existsSync('./bench.json'))
  rmSync('./bench.json')

try {
  await startVitest('benchmark', ['base.bench', 'mode.bench', 'only.bench'], {
    watch: false,
  })
}
catch (error) {
  console.error(error)
  process.exit(1)
}

const benchResult = await readFile('./bench.json', 'utf-8')
const resultJson = JSON.parse(benchResult)

await test('benchmarks are actually running', async () => {
  assert.ok(resultJson.testResults.sort, 'sort is in results')
  assert.ok(resultJson.testResults.timeout, 'timeout is in results')
  assert.ok(resultJson.testResults.a0, 'a0 is in results')
  assert.ok(resultJson.testResults.c1, 'c1 is in results')
  assert.ok(resultJson.testResults.a2, 'a2 is in results')
  assert.ok(resultJson.testResults.b3, 'b3 is in results')
  assert.ok(resultJson.testResults.b4, 'b4 is in results')
})

await test('doesn\'t have skipped tests', () => {
  assert.doesNotMatch(benchResult, /skip/, 'contains skipped benchmarks')

  const skippedBenches = ['s0', 's1', 's2', 's3', 'sb4', 's4']
  const todoBenches = ['unimplemented suite', 'unimplemented test']

  assert.ok(skippedBenches.concat(todoBenches).every(b => !benchResult.includes(b)), 'contains skipped benchmarks')
})
