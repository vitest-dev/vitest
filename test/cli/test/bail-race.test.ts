import { resolve } from 'pathe'
import { expect, it } from 'vitest'
import { createVitest } from 'vitest/node'

const root = resolve(import.meta.dirname, '../fixtures/bail-race')

it('should be able to bail fast without race conditions', async () => {
  const runController = new AbortController()
  const runPromise = Promise.resolve().then(async () => {
    const vitest = await createVitest('test', {
      pool: 'threads',
      coverage: { enabled: false },
      maxWorkers: 1,
      maxConcurrency: 1,
      watch: false,
      bail: 1,
      reporters: [],
      root,
    })
    while (vitest.state.errorsSet.size === 0 && !runController.signal.aborted) {
      await vitest.start()
    }
    await vitest.close()
    if (vitest.state.errorsSet.size > 0) {
      const msg = [...vitest.state.errorsSet]
        .map(err => (err as Error).message)
        .join('\n')
      throw new Error(`Tests failed with bail:\n${msg}`)
    }
  })

  const timeoutPromise = new Promise<void>(res => setTimeout(() => {
    runController.abort()
    res()
  }, 5000))

  await expect(Promise.race([runPromise, timeoutPromise])).resolves.toBeUndefined()
})
