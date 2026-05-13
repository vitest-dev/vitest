import { expect, test } from 'vitest'

// Keep runs tiny — this file smoke-tests the browser RPC path
// (onTestBenchmark, readBenchmarkResult / writeBenchmarkResult).
// It is not a measurement harness.
const fastBenchOptions = {
  time: 0,
  iterations: 2,
  warmupTime: 0,
  warmupIterations: 0,
}

test('perProject registrations flow through the browser RPC (onTestBenchmark)', async ({ bench }) => {
  await bench('1 + 1', { perProject: true, ...fastBenchOptions }, () => {
    const result = 1 + 1
    expect.assert(result === 2)
  }).run()
  await bench('1 + 2', { perProject: true, ...fastBenchOptions }, () => {
    const result = 1 + 2
    expect.assert(result === 3)
  }).run()
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

test('writeResult exercises the writeBenchmarkResult RPC round-trip', async ({ bench }) => {
  // The browser worker forwards writeResult through the WebSocket RPC to the
  // node side. We don't assert on the file contents here (the spec layer can
  // do that), just that the round-trip completes without throwing.
  const result = await bench('with-write', { writeResult: './out/with-write.json', ...fastBenchOptions }, () => {
    const _ = 1 + 1
  }).run()
  expect.assert(typeof result.latency.mean === 'number')
})
