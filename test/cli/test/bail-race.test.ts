import { Writable } from 'node:stream'
import { resolve } from 'pathe'
import { expect, it } from 'vitest'
import { createVitest } from 'vitest/node'

const root = resolve(import.meta.dirname, '../fixtures/bail-race')

class NoopStream extends Writable {
  override _write(_chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    callback()
  }
}

it('should be able to bail fast without race conditions', async () => {
  const abortController = new AbortController()
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
    }, {}, { stderr: new NoopStream(), stdout: new NoopStream() })
    while (vitest.state.errorsSet.size === 0 && !abortController.signal.aborted) {
      await vitest.start()
    }
    await vitest.close()
    abortController.abort()
    if (vitest.state.errorsSet.size > 0) {
      const msg = [...vitest.state.errorsSet]
        .map(err => (err as Error).message)
        .join('\n')
      throw new Error(`Tests failed with bail:\n${msg}`)
    }
  })

  const timeoutPromise = new Promise<void>((res) => {
    const timeoutId = setTimeout(() => {
      abortController.abort()
      res()
    }, 5000)
    abortController.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId)
    })
  })

  await expect(Promise.race([runPromise, timeoutPromise])).resolves.toBeUndefined()
})
