import { createVitest } from 'vitest/node'

const runPromise = Promise.resolve().then(async () => {
  const vitest = await createVitest('test', {
    pool: 'threads',
    coverage: { enabled: false },
    maxWorkers: 1,
    maxConcurrency: 1,
    watch: false,
    bail: 1,
    reporters: [],
  })
  while (vitest.state.errorsSet.size === 0) {
    await vitest.start()
  }
  const msg = [...vitest.state.errorsSet]
    .map(err => err.message)
    .join('\n')
  throw new Error(`Tests failed with bail:\n${msg}`)
})

const timeoutPromise = new Promise(res => setTimeout(() => {
  res()
}, 5000))

await Promise.race([runPromise, timeoutPromise])

// eslint-disable-next-line no-console
console.log('Test passed: bail works as expected')
process.exit(0)
