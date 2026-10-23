import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'pathe'
import { expect, onTestFailed, onTestFinished, test } from 'vitest'
import { defaultExclude } from 'vitest/config'
import { editFile, runVitest } from '../../test-utils'
import { instances, provider } from '../settings'
import { runInlineBrowserTests } from './utils'

test.each([
  { isolate: true, importMapMocks: false },
  { isolate: true, importMapMocks: true },
])(
  'mocking works correctly - isolated $isolate, importMapMocks $importMapMocks',
  async ({ isolate, importMapMocks }) => {
    const result = await runVitest({
      root: 'fixtures/mocking',
      isolate,
      browser: { importMapMocks },
    })

    onTestFailed(() => {
      console.error(result.stdout)
      console.error(result.stderr)
    })

    expect(result.stderr).toReportNoErrors()

    instances.forEach(({ browser }) => {
      expect(result.stdout).toReportPassedTest('automocked.test.ts', browser)
      expect(result.stdout).toReportPassedTest('automocked-default-return.test.ts', browser)
      expect(result.stdout).toReportPassedTest('mocked-__mocks__.test.ts', browser)
      expect(result.stdout).toReportPassedTest('mocked-factory.test.ts', browser)
      expect(result.stdout).toReportPassedTest('mocked-factory-hoisted.test.ts', browser)
      expect(result.stdout).toReportPassedTest('mocked-factory-star.test.ts', browser)
      expect(result.stdout).toReportPassedTest('not-mocked.test.ts', browser)
      expect(result.stdout).toReportPassedTest('mocked-nested.test.ts', browser)
      expect(result.stdout).toReportPassedTest('not-mocked-nested.test.ts', browser)
      expect(result.stdout).toReportPassedTest('import-actual-in-mock.test.ts', browser)
      expect(result.stdout).toReportPassedTest('import-actual-query.test.ts', browser)
      expect(result.stdout).toReportPassedTest('import-mock.test.ts', browser)
      expect(result.stdout).toReportPassedTest('src/aaa-dual-id-probe.test.ts', browser)
      expect(result.stdout).toReportPassedTest('src/zzz-dual-id-target.test.ts', browser)
      expect(result.stdout).toReportPassedTest('mocked-do-mock-factory.test.ts', browser)
      expect(result.stdout).toReportPassedTest('import-actual-dep.test.ts', browser)
    })

    expect(result.exitCode).toBe(0)
  },
)

test('manual mocks do not leak across browser files when alias and relative ids resolve to the same module', async () => {
  const result = await runVitest(
    {
      root: 'fixtures/mocking',
    },
    ['src/aaa-dual-id-probe.test.ts', 'src/zzz-dual-id-target.test.ts'],
  )

  onTestFailed(() => {
    console.error(result.stdout)
    console.error(result.stderr)
  })

  expect(result.stderr).toReportNoErrors()

  instances.forEach(({ browser }) => {
    expect(result.stdout).toReportPassedTest('src/aaa-dual-id-probe.test.ts', browser)
    expect(result.stdout).toReportPassedTest('src/zzz-dual-id-target.test.ts', browser)
  })

  expect(result.exitCode).toBe(0)
}, 60_000)

test('mocking dependency correctly invalidates it on rerun', async () => {
  const { vitest, ctx } = await runVitest({
    root: 'fixtures/mocking-watch',
    watch: true,
  })
  onTestFinished(async () => {
    await ctx.close()
  })

  await vitest.waitForStdout('Waiting for file changes...')

  expect(vitest.stderr).toReportNoErrors()

  instances.forEach(({ browser }) => {
    expect(vitest.stdout).toReportPassedTest('1_mocked-on-watch-change.test.ts', browser)
    expect(vitest.stdout).toReportPassedTest('2_not-mocked-import.test.ts', browser)
  })

  vitest.resetOutput()
  editFile('./fixtures/mocking-watch/1_mocked-on-watch-change.test.ts', (content) => `${content}\n`)

  await vitest.waitForStdout('Waiting for file changes...')

  expect(vitest.stderr).toReportNoErrors()

  instances.forEach(({ browser }) => {
    expect(vitest.stdout).toReportPassedTest('1_mocked-on-watch-change.test.ts', browser)
    expect(vitest.stdout).not.toReportPassedTest('2_not-mocked-import.test.ts', browser)
  })
})

test('mocking out of root', async () => {
  const { vitest, ctx } = await runVitest({
    root: 'fixtures/mocking-out-of-root/project1',
  })
  onTestFinished(async () => {
    await ctx.close()
  })
  expect(vitest.stderr).toReportNoErrors()
  instances.forEach(({ browser }) => {
    expect(vitest.stdout).toReportPassedTest('basic.test.js', browser)
  })
})

// fix https://github.com/vitest-dev/vitest/issues/11519
test.each([false, true])(
  'mocks from a setup file apply to static imports of a test file - importMapMocks %s',
  async (importMapMocks) => {
    const result = await runVitest({
      root: 'fixtures/mocking-setup-file',
      browser: { importMapMocks },
    })

    onTestFailed(() => {
      console.error(result.stdout)
      console.error(result.stderr)
    })

    expect(result.stderr).toReportNoErrors()

    instances.forEach(({ browser }) => {
      expect(result.stdout).toReportPassedTest('static-import.test.ts', browser)
      expect(result.stdout).toReportPassedTest('dynamic-import.test.ts', browser)
    })

    expect(result.exitCode).toBe(0)
  },
)

test.each([false, true])(
  'a mock of a module that a setup file already imported fails - importMapMocks %s',
  async (importMapMocks) => {
    const result = await runVitest({
      root: 'fixtures/mocking-import-map-conflict',
      browser: { importMapMocks },
    })

    const trees = moduleResults(result)
    expect(Object.keys(trees).sort()).toEqual(instances.map(({ browser }) => browser).sort())
    for (const tree of Object.values(trees)) {
      expect(tree).toMatchInlineSnapshot(`
        {
          "already-imported.test.ts": [
            "Cannot mock "/source.ts": the page already imported it before vi.mock was registered, for example by a setup file or by an earlier dynamic import. A module cannot be evaluated again in the browser.",
          ],
        }
      `)
    }
    expect(result.exitCode).toBe(1)
  },
)

test('files that share a page report the mocks that leak between them', async () => {
  const result = await runVitest({
    root: 'fixtures/mocking-non-isolated',
  })

  onTestFailed(() => {
    console.error(result.stdout)
    console.error(result.stderr)
  })

  const trees = moduleResults(result)
  expect(Object.keys(trees).sort()).toEqual(instances.map(({ browser }) => browser).sort())
  for (const tree of Object.values(trees)) {
    expect(tree).toMatchInlineSnapshot(`
      {
        "late/1-original.test.ts": "passed",
        "late/2-mock.test.ts": [
          "Cannot mock "/src/late.ts": the page already imported it while running "late/1-original.test.ts". Test files share the page when "isolate" is false, and a module cannot be evaluated again. Mock "/src/late.ts" the same way in a setup file, or run the files that mock it in an isolated project.",
        ],
        "leak/1-mock.test.ts": "passed",
        "leak/2-original.test.ts": [
          ""leak/2-original.test.ts" imports "/src/leak.ts", which the page already imported as a mock while running "leak/1-mock.test.ts". The mocked module stays in the page when "isolate" is false. Mock "/src/leak.ts" in this file too, or run the files that need the original in an isolated project.",
        ],
        "leak/3-consumer.test.ts": [
          ""src/consumer.ts" imports "/src/leak.ts", which the page already imported as a mock while running "leak/1-mock.test.ts". The mocked module stays in the page when "isolate" is false. Mock "/src/leak.ts" in this file too, or run the files that need the original in an isolated project.",
        ],
        "own/1-mock.test.ts": "passed",
        "refactory/1-a.test.ts": "passed",
        "refactory/2-b.test.ts": [
          "Cannot mock "/src/refactory.ts": the page already imported it as a mock while running "refactory/1-a.test.ts". Test files share the page when "isolate" is false, and a module cannot be evaluated again. Mock "/src/refactory.ts" the same way in a setup file, or run the files that mock it in an isolated project.",
        ],
        "shared/1-setup-mock.test.ts": "passed",
        "shared/2-setup-mock.test.ts": "passed",
        "unloaded/1-mock-not-loaded.test.ts": "passed",
        "unloaded/2-original.test.ts": "passed",
        "unmock/1-unmock.test.ts": [
          "vi.unmock("/src/shared.ts") has no effect: "unmock/1-unmock.test.ts" imports "/src/shared.ts", which the page already imported as the mock from "setup.ts" while running "shared/1-setup-mock.test.ts". The mocked module stays in the page when "isolate" is false. Mock "/src/shared.ts" in this file too, or run the files that need the original in an isolated project.",
        ],
      }
    `)
  }
  expect(result.exitCode).toBe(1)
})

// a file that fails to import reports the cause of the failure
function moduleResults({ results }: Awaited<ReturnType<typeof runVitest>>) {
  const trees: Record<string, Record<string, string | string[]>> = {}
  for (const module of results) {
    const tree = (trees[module.project.name] ??= {})
    tree[module.relativeModuleId] = module.ok()
      ? 'passed'
      : module.errors().map(({ cause, message }) => {
          return typeof cause === 'object' && cause && 'message' in cause
            ? String(cause.message)
            : message
        })
  }
  return trees
}

test.runIf(provider.name === 'playwright')(
  'mocks fall back to request interception when the browser rejects a late import map',
  async () => {
    const result = await runVitest({
      root: 'fixtures/mocking-import-map-fallback',
    })

    onTestFailed(() => {
      console.error(result.stdout)
      console.error(result.stderr)
    })

    expect(result.stderr).toReportNoErrors()
    expect(result.stdout).toReportPassedTest('automocked.test.ts', 'firefox')
    expect(result.stdout).toReportPassedTest('factory.test.ts', 'firefox')
    expect(result.exitCode).toBe(0)
  },
)

test.each([false, undefined])(
  'a factory mock that no test imports does not transform the original - importMapMocks %s',
  async (importMapMocks) => {
    const transformed = resolve(
      import.meta.dirname,
      '../fixtures/mocking-unused-factory/node_modules/.vite/transformed.log',
    )
    rmSync(transformed, { force: true })

    const result = await runVitest({
      root: 'fixtures/mocking-unused-factory',
      browser: { importMapMocks },
    })

    onTestFailed(() => {
      console.error(result.stdout)
      console.error(result.stderr)
    })

    expect(result.stderr).toReportNoErrors()
    instances.forEach(({ browser }) => {
      expect(result.stdout).toReportPassedTest('no-import.test.ts', browser)
    })
    expect(existsSync(transformed)).toBe(false)
  },
)

test.each([undefined, true])(
  'vi.unmock in a test file removes the mocks of a setup file - importMapMocks %s',
  async (importMapMocks) => {
    const result = await runVitest({
      root: 'fixtures/mocking-unmock',
      exclude: [...defaultExclude, '**/do-unmock.test.ts'],
      browser: { importMapMocks },
    })

    onTestFailed(() => {
      console.error(result.stdout)
      console.error(result.stderr)
    })

    expect(result.stderr).toReportNoErrors()

    instances.forEach(({ browser }) => {
      expect(result.stdout).toReportPassedTest('mocked.test.ts', browser)
      expect(result.stdout).toReportPassedTest('unmock.test.ts', browser)
      expect(result.stdout).toReportPassedTest('unmock-do-mock.test.ts', browser)
    })

    expect(result.exitCode).toBe(0)
  },
)

// an import map rule cannot be removed, so vi.doUnmock needs request interception
test('vi.unmock and vi.doUnmock restore modules mocked in a setup file', async () => {
  const result = await runVitest({
    root: 'fixtures/mocking-unmock',
    browser: { importMapMocks: false },
  })

  onTestFailed(() => {
    console.error(result.stdout)
    console.error(result.stderr)
  })

  expect(result.stderr).toReportNoErrors()

  instances.forEach(({ browser }) => {
    expect(result.stdout).toReportPassedTest('mocked.test.ts', browser)
    expect(result.stdout).toReportPassedTest('unmock.test.ts', browser)
    expect(result.stdout).toReportPassedTest('do-unmock.test.ts', browser)
    expect(result.stdout).toReportPassedTest('unmock-do-mock.test.ts', browser)
  })

  expect(result.exitCode).toBe(0)
})

test.each([true, false])(
  'a mock that a file never loads does not apply to the next file - isolated %s',
  async (isolate) => {
    const result = await runVitest({
      root: 'fixtures/mocking-unloaded',
      isolate,
    })

    onTestFailed(() => {
      console.error(result.stdout)
      console.error(result.stderr)
    })

    expect(result.stderr).toReportNoErrors()

    instances.forEach(({ browser }) => {
      expect(result.stdout).toReportPassedTest('1-mock-not-loaded.test.ts', browser)
      expect(result.stdout).toReportPassedTest('2-original.test.ts', browser)
    })

    expect(result.exitCode).toBe(0)
  },
)

// fix https://github.com/vitest-dev/vitest/issues/7788
test('mocks modules next to a test file in a directory with spaces', async () => {
  const { errorTree } = await runInlineBrowserTests({
    'space dir/source.ts': `export function answer() { return 42 }`,
    'space dir/redirect.ts': `export function value() { return 'original' }`,
    'space dir/__mocks__/redirect.ts': `export function value() { return 'mocked' }`,
    'space dir/factory.ts': `export const name = 'original'`,
    'space dir/basic.test.ts': `
import { expect, test, vi } from 'vitest'
import { name } from './factory'
import { value } from './redirect'
import { answer } from './source'

vi.mock('./source', { spy: true })
vi.mock('./redirect')
vi.mock('./factory', () => ({ name: 'factory' }))

test('spy', () => {
  expect(vi.isMockFunction(answer)).toBe(true)
})

test('redirect', () => {
  expect(value()).toBe('mocked')
})

test('factory', () => {
  expect(name).toBe('factory')
})

test('error location', () => {
  expect(answer()).toBe(0)
})
`,
  })

  const trees = errorTree({ project: true, stackTrace: true })
  expect(Object.keys(trees).sort()).toEqual(instances.map(({ browser }) => browser).sort())
  for (const tree of Object.values(trees)) {
    expect(tree).toMatchInlineSnapshot(`
      {
        "space dir/basic.test.ts": {
          "error location": [
            "expected 42 to be +0 // Object.is equality
          at space dir/basic.test.ts:24:20",
          ],
          "factory": "passed",
          "redirect": "passed",
          "spy": "passed",
        },
      }
    `)
  }
})
