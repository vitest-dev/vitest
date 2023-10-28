import { resolve } from 'pathe'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'

import { runVitest } from '../../test-utils'

// To prevent the warnining coming up in snapshots
process.setMaxListeners(20)

describe('stacktraces should respect sourcemaps', async () => {
  const root = resolve(__dirname, '../fixtures')
  const files = await fg('*.test.*', { cwd: root })

  for (const file of files) {
    it(file, async () => {
      const { stderr } = await runVitest({ root }, [file])

      expect(stderr).toBeTruthy()
      const lines = String(stderr).split(/\n/g)
      const index = lines.findIndex(val => val.includes(`${file}:`))
      const msg = lines.slice(index, index + 8).join('\n')
      expect(msg).toMatchSnapshot(file)
    }, 30000)
  }
})

describe('stacktraces should pick error frame if present', async () => {
  const root = resolve(__dirname, '../fixtures')
  const files = ['frame.spec.imba']

  for (const file of files) {
    it(file, async () => {
      const { stderr } = await runVitest({ root }, [file])

      expect(stderr).toBeTruthy()
      const lines = String(stderr).split(/\n/g)
      const index = lines.findIndex(val => val.includes('FAIL'))
      const msg = lines.slice(index, index + 8).join('\n')
      expect(msg).toMatchSnapshot(file)
    }, 30000)
  }
})

describe('stacktrace should print error frame source file correctly', async () => {
  const root = resolve(__dirname, '../fixtures')
  const testFile = resolve(root, './error-in-deps.test.js')

  it('error-in-deps', async () => {
    const { stderr } = await runVitest({ root }, [testFile])

    // expect to print framestack of foo.js
    expect(stderr).toMatchSnapshot('error-in-deps')
  }, 30000)
})

describe('stacktrace filtering', async () => {
  const root = resolve(__dirname, '../fixtures')
  const testFile = resolve(root, './error-with-stack.test.js')

  it('filters stacktraces', async () => {
    const { stderr } = await runVitest({
      root,
      onStackTrace: (_error, { method }) => method !== 'b',
    }, [testFile])

    expect(stderr).toMatchSnapshot('stacktrace-filtering')
  }, 30000)
})
