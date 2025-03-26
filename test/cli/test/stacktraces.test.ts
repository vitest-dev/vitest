import { resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { describe, expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

const [major] = process.version.slice(1).split('.').map(num => Number(num))

// To prevent the warning coming up in snapshots
process.setMaxListeners(20)

describe('stacktraces should respect sourcemaps', async () => {
  const root = resolve(__dirname, '../fixtures/stacktraces')
  const files = await glob(['*.test.*'], { cwd: root, expandDirectories: false })

  for (const file of files) {
    it(file, async () => {
      const { stderr } = await runVitest({ root }, [file])

      expect(stderr).toBeTruthy()
      const lines = String(stderr).split(/\n/g)
      const index = lines.findIndex(val => val.includes(`${file}:`))
      const msg = lines.slice(index, index + 8).join('\n')
      expect(removeLines(msg)).toMatchSnapshot()
    })
  }
})

describe('stacktraces should pick error frame if present', async () => {
  const root = resolve(__dirname, '../fixtures/stacktraces')
  const files = ['frame.spec.imba']

  for (const file of files) {
    it(file, async () => {
      const { stderr } = await runVitest({ root }, [file])

      expect(stderr).toBeTruthy()
      const lines = String(stderr).split(/\n/g)
      const index = lines.findIndex(val => val.includes('FAIL'))
      const msg = lines.slice(index, index + 8).join('\n')
      expect(msg).toMatchSnapshot()
    })
  }
})

describe('stacktrace should print error frame source file correctly', async () => {
  const root = resolve(__dirname, '../fixtures/stacktraces')
  const testFile = resolve(root, './error-in-deps.test.js')

  it('error-in-deps', async () => {
    const { stderr } = await runVitest({ root }, [testFile])

    // expect to print framestack of foo.js
    expect(removeLines(stderr)).toMatchSnapshot()
  })
})

describe('stacktrace filtering', async () => {
  const root = resolve(__dirname, '../fixtures/stacktraces')
  const testFile = resolve(root, './error-with-stack.test.js')

  it('filters stacktraces', async () => {
    const { stderr } = await runVitest({
      root,
      onStackTrace: (_error, { method }) => method !== 'b',
    }, [testFile])

    expect(removeLines(stderr)).toMatchSnapshot()
  })
})

describe('stacktrace in dependency package', () => {
  const root = resolve(__dirname, '../fixtures/stacktraces')
  const testFile = resolve(root, './error-in-package.test.js')

  it('external', async () => {
    const { stderr } = await runVitest({
      root,
    }, [testFile])
    expect(removeNodeModules(removeLines(stderr))).toMatchSnapshot()
  })

  it('inline', async () => {
    const { stderr } = await runVitest({
      root,
      server: {
        deps: {
          inline: [/@vitest\/test-dep-error/],
        },
      },
    }, [testFile])
    expect(removeNodeModules(removeLines(stderr))).toMatchSnapshot()
  })
})

it.runIf(major < 22)('stacktrace in vmThreads', async () => {
  const root = resolve(__dirname, '../fixtures/stacktraces')
  const testFile = resolve(root, './error-with-stack.test.js')
  const { stderr } = await runVitest({
    root,
    pool: 'vmThreads',
  }, [testFile])

  expect(removeLines(stderr)).toMatchSnapshot()
})

function removeLines(log: string) {
  return log.replace(/⎯{2,}/g, '⎯⎯')
}

function removeNodeModules(log: string) {
  return log.replace(/[^ ]*\/node_modules\//g, '(NODE_MODULES)/')
}
