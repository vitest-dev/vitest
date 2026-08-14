import type { TestModule } from 'vitest/node'
import MagicString from 'magic-string'
import { describe, expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

async function getSourceModuleDiagnostic(
  source: string,
  dependencies: Record<string, string>,
  targetModuleFile = './source.test.js',
) {
  const { fs, root, ctx, stderr } = await runInlineTests({
    'source.test.js': source,
    ...dependencies,
  }, {
    experimental: {
      importDurations: {
        limit: 100,
      },
    },
  })

  expect(stderr).toBe('')
  expect(ctx).toBeDefined()

  const testFileId = fs.resolveFile('./source.test.js')
  const testFile = ctx!.state.filesMap.get(testFileId)
  if (!testFile?.length) {
    throw new Error(`Test file was not collected: ${testFileId}`)
  }

  // Use the executed test's Vite environment while diagnosing the requested module.
  const testModule = ctx!.state.getReportedEntity(testFile[0]) as TestModule
  const moduleId = fs.resolveFile(targetModuleFile)
  const diagnostic = await ctx!.experimental_getSourceModuleDiagnostic(moduleId, testModule)
  const localModules = diagnostic.modules.filter(module => module.rawUrl.startsWith('./'))

  return {
    diagnostic,
    localModules,
    root,
  }
}

function normalizeModules(
  modules: Awaited<ReturnType<typeof getSourceModuleDiagnostic>>['diagnostic']['modules'],
  root: string,
) {
  return modules.map(({ selfTime, totalTime, transformTime, ...module }) => ({
    ...module,
    resolvedId: module.resolvedId.replace(root, '<root>'),
    importer: module.importer?.replace(root, '<root>'),
    timingTypes: {
      selfTime: typeof selfTime,
      totalTime: typeof totalTime,
      transformTime: typeof transformTime,
    },
  }))
}

function normalizeUntrackedModules(
  modules: Awaited<ReturnType<typeof getSourceModuleDiagnostic>>['diagnostic']['untrackedModules'],
  root: string,
) {
  return [...modules]
    .sort((a, b) => a.resolvedUrl.localeCompare(b.resolvedUrl))
    .map(({ selfTime, totalTime, transformTime, ...module }) => ({
      ...module,
      resolvedId: module.resolvedId.replace(root, '<root>'),
      importer: module.importer?.replace(root, '<root>'),
      timingTypes: {
        selfTime: typeof selfTime,
        totalTime: typeof totalTime,
        transformTime: typeof transformTime,
      },
    }))
}

describe('experimental_getSourceModuleDiagnostic', () => {
  test('Static imports and re-exports should receive source locations and duration information', async ({ skip, task }) => {
    skip(task.file.pool !== 'threads', 'run only once inside threads')

    const source = `
import { expect, test } from 'vitest'
import { value } from './dependency.js'
export { reexported } from './reexported.js'

test('uses an imported value', () => {
  expect(value).toBe(42)
})
`
    const { diagnostic, root, localModules } = await getSourceModuleDiagnostic(source, {
      'dependency.js': 'export const value = 42',
      'reexported.js': 'export const reexported = true',
    })

    expect(diagnostic.untrackedModules).toEqual([])
    expect(localModules).toHaveLength(2)
    expect(localModules.map(module => source.slice(module.startIndex, module.endIndex))).toEqual([
      '\'./dependency.js\'',
      '\'./reexported.js\'',
    ])
    expect(normalizeModules(localModules, root)).toMatchInlineSnapshot(`
      [
        {
          "end": {
            "column": 39,
            "line": 3,
          },
          "endIndex": 78,
          "external": undefined,
          "importer": "<root>/source.test.js",
          "rawUrl": "./dependency.js",
          "resolvedId": "<root>/dependency.js",
          "resolvedUrl": "/dependency.js",
          "start": {
            "column": 22,
            "line": 3,
          },
          "startIndex": 61,
          "timingTypes": {
            "selfTime": "number",
            "totalTime": "number",
            "transformTime": "number",
          },
        },
        {
          "end": {
            "column": 44,
            "line": 4,
          },
          "endIndex": 123,
          "external": undefined,
          "importer": "<root>/source.test.js",
          "rawUrl": "./reexported.js",
          "resolvedId": "<root>/reexported.js",
          "resolvedUrl": "/reexported.js",
          "start": {
            "column": 27,
            "line": 4,
          },
          "startIndex": 106,
          "timingTypes": {
            "selfTime": "number",
            "totalTime": "number",
            "transformTime": "number",
          },
        },
      ]
    `)
  })

  test('Importing the same resolved module twice should not count its loading cost twice.', async ({ skip, task }) => {
    skip(task.file.pool !== 'threads', 'run only once inside threads')

    const source = `
import { expect, test } from 'vitest'
import { value } from './dependency.js'
import { value as duplicate } from './dependency.js'

test('uses both imports', () => {
  expect(value + duplicate).toBe(84)
})
`
    const { diagnostic, root } = await getSourceModuleDiagnostic(source, {
      'dependency.js': 'export const value = 42',
    })

    const dependencyModules = diagnostic.modules.filter(module => module.rawUrl === './dependency.js')
    const [firstImport, secondImport] = dependencyModules

    expect(dependencyModules).toHaveLength(2)
    expect(firstImport.resolvedId).toBe(secondImport.resolvedId)
    expect(firstImport.start).not.toEqual(secondImport.start)
    expect(secondImport).toMatchObject({
      selfTime: 0,
      totalTime: 0,
      transformTime: 0,
    })
    expect(normalizeModules(dependencyModules, root)).toMatchInlineSnapshot(`
      [
        {
          "end": {
            "column": 39,
            "line": 3,
          },
          "endIndex": 78,
          "external": undefined,
          "importer": "<root>/source.test.js",
          "rawUrl": "./dependency.js",
          "resolvedId": "<root>/dependency.js",
          "resolvedUrl": "/dependency.js",
          "start": {
            "column": 22,
            "line": 3,
          },
          "startIndex": 61,
          "timingTypes": {
            "selfTime": "number",
            "totalTime": "number",
            "transformTime": "number",
          },
        },
        {
          "end": {
            "column": 52,
            "line": 4,
          },
          "endIndex": 131,
          "external": undefined,
          "importer": "<root>/source.test.js",
          "rawUrl": "./dependency.js",
          "resolvedId": "<root>/dependency.js",
          "resolvedUrl": "/dependency.js",
          "start": {
            "column": 35,
            "line": 4,
          },
          "startIndex": 114,
          "timingTypes": {
            "selfTime": "number",
            "totalTime": "number",
            "transformTime": "number",
          },
        },
      ]
    `)
  })

  test('non transformed modules should return an empty diagnostic', async ({ skip, task }) => {
    skip(task.file.pool !== 'threads', 'run only once inside threads')

    const source = `
import { expect, test } from 'vitest'
import { value } from './used.js'

test('uses an imported value', () => {
  expect(value).toBe(42)
})
`
    const { diagnostic } = await getSourceModuleDiagnostic(source, {
      'used.js': 'export const value = 42',
      'unused.js': 'export const used = false',
    }, './unused.js')

    expect(diagnostic).toEqual({
      modules: [],
      untrackedModules: [],
    })
  })

  test('should aggregate durations from all test modules when no testModule is provided', async ({ skip, task }) => {
    skip(task.file.pool !== 'threads', 'run only once inside threads')

    const sharedSource = `
import { value } from './dependency.js'
export const shared = value
`
    const { fs, root, ctx, stderr } = await runInlineTests({
      'shared.js': sharedSource,
      'dependency.js': 'export const value = 42',
      'first.test.js': `
import { expect, test } from 'vitest'
import { shared } from './shared.js'
test('first test', () => expect(shared).toBe(42))
`,
      'second.test.js': `
import { expect, test } from 'vitest'
import { shared } from './shared.js'
test('second test', () => expect(shared).toBe(42))
`,
    }, {
      experimental: {
        importDurations: {
          limit: 100,
        },
      },
    })

    expect(stderr).toBe('')
    expect(ctx).toBeDefined()

    const getTestModule = (filename: string) => {
      const file = fs.resolveFile(filename)
      const testFiles = ctx!.state.filesMap.get(file)
      if (!testFiles?.length) {
        throw new Error(`Test file was not collected: ${file}`)
      }
      return ctx!.state.getReportedEntity(testFiles[0]) as TestModule
    }

    const sharedId = fs.resolveFile('./shared.js')
    const firstDiagnostic = await ctx!.experimental_getSourceModuleDiagnostic(
      sharedId,
      getTestModule('./first.test.js'),
    )
    const secondDiagnostic = await ctx!.experimental_getSourceModuleDiagnostic(
      sharedId,
      getTestModule('./second.test.js'),
    )
    const aggregatedDiagnostic = await ctx!.experimental_getSourceModuleDiagnostic(sharedId)

    const firstDependency = firstDiagnostic.modules.find(module => module.rawUrl === './dependency.js')
    const secondDependency = secondDiagnostic.modules.find(module => module.rawUrl === './dependency.js')
    const aggregatedDependency = aggregatedDiagnostic.modules.find(module => module.rawUrl === './dependency.js')

    if (!firstDependency || !secondDependency || !aggregatedDependency) {
      throw new Error('Expected dependency diagnostic was not collected')
    }

    expect(aggregatedDependency.selfTime).toBe(firstDependency.selfTime + secondDependency.selfTime)
    expect(aggregatedDependency.totalTime).toBe(firstDependency.totalTime + secondDependency.totalTime)
    expect(sharedSource.slice(aggregatedDependency.startIndex, aggregatedDependency.endIndex)).toBe(
      '\'./dependency.js\'',
    )
    expect(normalizeModules([aggregatedDependency], root)).toMatchInlineSnapshot(`
      [
        {
          "end": {
            "column": 39,
            "line": 2,
          },
          "endIndex": 40,
          "external": undefined,
          "importer": "<root>/shared.js",
          "rawUrl": "./dependency.js",
          "resolvedId": "<root>/dependency.js",
          "resolvedUrl": "/dependency.js",
          "start": {
            "column": 22,
            "line": 2,
          },
          "startIndex": 23,
          "timingTypes": {
            "selfTime": "number",
            "totalTime": "number",
            "transformTime": "number",
          },
        },
      ]
    `)
  })

  test('should report imports that are injected during transformation as untracked', async ({ skip, task }) => {
    skip(task.file.pool !== 'threads', 'run only once inside threads')

    const originalImport = 'import \'./original.js\''
    const source = `${originalImport}
import { test } from 'vitest'
test('loads injected modules', () => {})
`
    const { fs, root, ctx, stderr } = await runInlineTests({
      'source.test.js': source,
      'original.js': '',
      'injected-first.js': '',
    }, {
      experimental: {
        importDurations: {
          limit: 100,
        },
      },
      $viteConfig: {
        plugins: [
          {
            name: 'inject-module-imports',
            enforce: 'pre',
            transform(code, id) {
              if (!id.endsWith('/source.test.js')) {
                return
              }

              const importIndex = code.indexOf(originalImport)
              const transformed = new MagicString(code)
              const injectedImports = [
                'import \'./injected-first.js\'',
                originalImport,
              ].join('\n')
              transformed.overwrite(importIndex, importIndex + originalImport.length, injectedImports)
              const map = transformed.generateMap({
                hires: true,
                includeContent: true,
                source: id,
              })
              // Map both generated imports to the original import so the injected one is reported as untracked.
              map.mappings = map.mappings.replace(/^AAAA/, 'AAAC')

              return {
                code: transformed.toString(),
                map,
              }
            },
          },
        ],
      },
    })

    expect(stderr).toBe('')
    expect(ctx).toBeDefined()

    const file = fs.resolveFile('./source.test.js')
    const testFiles = ctx!.state.filesMap.get(file)
    if (!testFiles?.length) {
      throw new Error(`Test file was not collected: ${file}`)
    }

    const testModule = ctx!.state.getReportedEntity(testFiles[0]) as TestModule
    const diagnostic = await ctx!.experimental_getSourceModuleDiagnostic(file, testModule)
    const originalModule = diagnostic.modules.find(module => module.rawUrl === './original.js')

    expect(originalModule?.resolvedId).toBe(fs.resolveFile('./original.js'))
    expect(source.slice(originalModule!.startIndex, originalModule!.endIndex)).toBe('\'./original.js\'')
    expect(diagnostic.untrackedModules).toHaveLength(1)
    expect(normalizeUntrackedModules(diagnostic.untrackedModules, root)).toMatchInlineSnapshot(`
      [
        {
          "external": undefined,
          "importer": "<root>/source.test.js",
          "resolvedId": "<root>/injected-first.js",
          "resolvedUrl": "/injected-first.js",
          "timingTypes": {
            "selfTime": "number",
            "totalTime": "number",
            "transformTime": "number",
          },
          "url": "./original.js",
        },
      ]
    `)
  })
})
