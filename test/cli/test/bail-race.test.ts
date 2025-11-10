import type { RunnerTestCase, RunnerTestSuite } from 'vitest/node'
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
  // Arrange
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

    // Act
    while (vitest.state.errorsSet.size === 0 && !abortController.signal.aborted) {
      await vitest.start()
      const tests = vitest.state.getFiles().flatMap(file => collectTestsFromSuite(file)).map(({ name, result }) => ({ name, state: result?.state }))
      expect(tests).toEqual( // verify that nothing strange happened
        [
          {
            name: 'adds two numbers',
            state: 'pass',
          },
          {
            name: 'fails adding two numbers',
            state: 'fail',
          },
        ],
      )
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

  const timeoutPromise = new Promise<'timeout'>((res) => {
    const timeoutId = setTimeout(() => {
      abortController.abort()
      res('timeout') // Success!
    }, 5_000) // Give race condition 5 seconds to manifest
    abortController.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId)
    })
  })

  // Assert
  await expect(Promise.race([runPromise, timeoutPromise])).resolves.toBe('timeout')
})

function collectTestsFromSuite(
  suite: RunnerTestSuite,
): RunnerTestCase[] {
  return suite.tasks.flatMap((task) => {
    if (task.type === 'suite') {
      return collectTestsFromSuite(task)
    }
    else if (task.type === 'test') {
      return task
    }
    else {
      return []
    }
  })
}
