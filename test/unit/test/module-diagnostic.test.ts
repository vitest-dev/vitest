import type { RunnerTestFile } from 'vitest'
import type { TestModule } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

// `experimental_getSourceModuleDiagnostic` only attaches timings when the
// `importDurations` experimental feature is collecting them, so it is enabled by default here.
async function getDiagnostic(
  structure: Record<string, string>,
  moduleFile: string,
  options?: { withTestModule?: boolean; importDurations?: boolean },
) {
  const importDurations = options?.importDurations ?? true
  const { fs, ctx } = await runInlineTests(
    structure,
    importDurations ? { experimental: { importDurations: { limit: 100 } } } : {},
  )

  const moduleId = fs.resolveFile(moduleFile)

  let testModule: TestModule | undefined
  if (options?.withTestModule) {
    const testFile = ctx!.state.filesMap.get(moduleId) as RunnerTestFile[] | undefined
    testModule = testFile?.length
      ? ctx!.state.getReportedEntity(testFile[0]) as TestModule
      : undefined
  }

  const diagnostic = await ctx!.experimental_getSourceModuleDiagnostic(moduleId, testModule)
  return { diagnostic, moduleId }
}

type SourceModuleDiagnostic = Awaited<ReturnType<typeof getDiagnostic>>['diagnostic']

function findByRawUrl(diagnostic: SourceModuleDiagnostic, rawUrl: string) {
  return diagnostic.modules.filter(m => m.rawUrl === rawUrl)
}

test('collects imported modules with their source locations and durations', async ({ skip, task }) => {
  skip(task.file.pool !== 'threads', 'run only once inside threads')

  const source = `\nimport { foo } from './dep'\nimport { test } from 'vitest'\ntest('t', () => { foo() })\n`
  const { diagnostic, moduleId } = await getDiagnostic(
    {
      'source.test.js': source,
      'dep.js': `export const foo = () => 1`,
    },
    './source.test.js',
    { withTestModule: true },
  )

  expect(diagnostic.untrackedModules).toEqual([])

  const [dep] = findByRawUrl(diagnostic, './dep')
  expect(dep).toBeDefined()

  // the location maps back to the original import in the source, which verifies the
  // SSR-transform -> source sourcemap resolution
  expect(dep.start).toEqual({ line: 2, column: 20 })
  expect(source.slice(dep.startIndex, dep.endIndex)).toBe(`'./dep'`)
  expect(dep.resolvedId).toMatch(/dep\.js$/)
  expect(dep.resolvedUrl).toBe('/dep.js')
  expect(dep.importer).toBe(moduleId)
  expect(dep.external).toBeFalsy()
  expect(dep.selfTime).toBeGreaterThanOrEqual(0)
  expect(dep.totalTime).toBeGreaterThanOrEqual(0)
  expect(typeof dep.transformTime).toBe('number')

  // bare specifiers resolved outside the project are flagged as external
  const [vitestImport] = findByRawUrl(diagnostic, 'vitest')
  expect(vitestImport).toBeDefined()
  expect(vitestImport.external).toBe(true)
})

test('reports a module imported twice in the same file only once with a duration', async ({ skip, task }) => {
  skip(task.file.pool !== 'threads', 'run only once inside threads')

  const source = `\nimport { foo } from './dep'\nimport { foo as foo2 } from './dep'\nimport { test } from 'vitest'\ntest('t', () => { foo(); foo2() })\n`
  const { diagnostic } = await getDiagnostic(
    {
      'source.test.js': source,
      'dep.js': `export const foo = () => 1`,
    },
    './source.test.js',
    { withTestModule: true },
  )

  const deps = findByRawUrl(diagnostic, './dep')
  expect(deps).toHaveLength(2)

  const [first, second] = deps
  expect(first.resolvedId).toBe(second.resolvedId)
  expect(first.start).not.toEqual(second.start)

  // the duplicate import is zeroed out so the same cost is not counted twice
  expect(second.selfTime).toBe(0)
  expect(second.totalTime).toBe(0)
  expect(second.transformTime).toBe(0)
  expect(first.totalTime).toBeGreaterThanOrEqual(second.totalTime)
})

test('aggregates across all test modules when no test module is provided', async ({ skip, task }) => {
  skip(task.file.pool !== 'threads', 'run only once inside threads')

  const source = `\nimport { foo } from './dep'\nimport { test } from 'vitest'\ntest('t', () => { foo() })\n`
  const { diagnostic } = await getDiagnostic(
    {
      'source.test.js': source,
      'dep.js': `export const foo = () => 1`,
    },
    './source.test.js',
    { withTestModule: false },
  )

  const [dep] = findByRawUrl(diagnostic, './dep')
  expect(dep).toBeDefined()
  expect(dep.resolvedId).toMatch(/dep\.js$/)
  expect(dep.selfTime).toBeGreaterThanOrEqual(0)
})

test('returns an empty diagnostic for a module without imports', async ({ skip, task }) => {
  skip(task.file.pool !== 'threads', 'run only once inside threads')

  const { diagnostic } = await getDiagnostic(
    {
      'source.test.js': `import { test } from 'vitest'\ntest('t', () => {})\n`,
      'lonely.js': `export const x = 1`,
    },
    './lonely.js',
  )

  expect(diagnostic).toEqual({ modules: [], untrackedModules: [] })
})

test('returns an empty diagnostic when import durations are disabled', async ({ skip, task }) => {
  skip(task.file.pool !== 'threads', 'run only once inside threads')

  const { diagnostic } = await getDiagnostic(
    {
      'source.test.js': `import { foo } from './dep'\nimport { test } from 'vitest'\ntest('t', () => { foo() })\n`,
      'dep.js': `export const foo = () => 1`,
    },
    './source.test.js',
    { withTestModule: true, importDurations: false },
  )

  expect(diagnostic).toEqual({ modules: [], untrackedModules: [] })
})
