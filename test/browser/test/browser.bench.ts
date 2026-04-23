import { expect, test } from 'vitest'

// Keep runs tiny — this file smoke-tests the browser RPC path
// (onTestBenchmark, readBenchmarkBaseline). It is not a measurement harness.
const fastBenchOptions = {
  time: 0,
  iterations: 2,
  warmupTime: 0,
  warmupIterations: 0,
}

test('perProject registrations flow through the browser RPC (onTestBenchmark)', async ({ bench }) => {
  await bench.perProject('1 + 1', () => {
    const result = 1 + 1
    expect.assert(result === 2)
  }).run(fastBenchOptions)
  await bench.perProject('1 + 2', () => {
    const result = 1 + 2
    expect.assert(result === 3)
  }).run(fastBenchOptions)
})

test('bench.compare resolves a BenchStorage in the browser', async ({ bench }) => {
  const storage = await bench.compare(
    bench('a', () => { const _ = 1 + 1 }),
    bench('b', () => { const _ = 1 + 2 }),
    fastBenchOptions,
  )
  // runtime smoke — every registration is accessible with a valid BenchResult
  expect.assert(typeof storage.get('a').latency.mean === 'number')
  expect.assert(typeof storage.get('b').latency.mean === 'number')
})

test('bench.withBaseline exercises the readBenchmarkBaseline RPC round-trip', async ({ bench }) => {
  // First call writes the baseline; the reporter path + saveBaselines RPC run.
  // Subsequent runs would read it back via readBenchmarkBaseline — this smoke
  // just verifies the round-trip doesn't throw.
  const result = await bench.withBaseline('with-baseline', () => {
    const _ = 1 + 1
  }).run(fastBenchOptions)
  expect.assert(typeof result.latency.mean === 'number')
})
