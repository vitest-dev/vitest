import { existsSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { startVitest } from 'vitest/node'
import { expect, test } from 'vitest'

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

test('benchmarks are actually running', async () => {
  expect(resultJson.testResults).toHaveProperty('sort')
  expect(resultJson.testResults).toHaveProperty('timeout')
  expect(resultJson.testResults).toHaveProperty('a0')
  expect(resultJson.testResults).toHaveProperty('c1')
  expect(resultJson.testResults).toHaveProperty('a2')
  expect(resultJson.testResults).toHaveProperty('b3')
  expect(resultJson.testResults).toHaveProperty('b4')
})

test('doesn\'t have skipped tests', () => {
  expect(benchResult).not.toMatch('skip')

  const skippedBenches = ['s0', 's1', 's2', 's3', 'sb4', 's4']
  const todoBenches = ['unimplemented suite', 'unimplemented test']

  expect(skippedBenches.concat(todoBenches)).not.toMatch(/skip/)
  expect(skippedBenches.concat(todoBenches).every(b => !benchResult.includes(b))).toBeTruthy()
})
