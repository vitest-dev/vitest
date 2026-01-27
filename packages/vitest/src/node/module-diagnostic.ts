import type { ImportDuration } from '@vitest/runner'
import type { EnvironmentModuleGraph, TransformResult } from 'vite'
import type {
  ModuleDefinitionDiagnostic,
  ModuleDefinitionDurationsDiagnostic,
  ModuleDefinitionLocation,
  SourceModuleDiagnostic,
  SourceModuleLocations,
  UntrackedModuleDefinitionDiagnostic,
} from '../types/module-locations'
import type { TestModule } from './reporters/reported-tasks'
import type { StateManager } from './state'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { createIndexLocationsMap } from '../utils/base'

// this function receives the module diagnostic with the location of imports
// and populates it with collected import durations; the duration is injected
// only if the current module is the one that imported the module
// if testModule is not defined, then Vitest aggregates durations of ALL collected test modules
export function collectModuleDurationsDiagnostic(
  moduleId: string,
  state: StateManager,
  moduleDiagnostic: SourceModuleLocations | undefined,
  testModule?: TestModule,
): SourceModuleDiagnostic {
  if (!moduleDiagnostic) {
    return { modules: [], untrackedModules: [] }
  }

  const modules: ModuleDefinitionDurationsDiagnostic[] = []
  const modulesById: Record<string, {
    selfTime: number
    totalTime: number
    transformTime?: number
    external?: boolean
    importer?: string
  }> = {}

  const allModules = [...moduleDiagnostic.modules, ...moduleDiagnostic.untracked]

  const visitedByFiles: Record<string, Set<string>> = {}

  // this aggregates the times for _ALL_ tests if testModule is not passed
  // so if the module was imported in separate tests, the time will be accumulated
  for (const files of (testModule ? [[testModule.task]] : state.filesMap.values())) {
    for (const file of files) {
      const importDurations = file.importDurations
      if (!importDurations) {
        continue
      }
      const currentModule = state.getReportedEntity(file) as TestModule | undefined
      if (!currentModule) {
        continue
      }
      const visitedKey = currentModule.project.config.isolate === false ? 'non-isolate' : file.id
      if (!visitedByFiles[visitedKey]) {
        visitedByFiles[visitedKey] = new Set()
      }
      const visited = visitedByFiles[visitedKey]

      allModules.forEach(({ resolvedId, resolvedUrl }) => {
        const durations = importDurations[resolvedId]
        // do not accumulate if module was already visited by suite (or suites in non-isolate mode)
        if (!durations || visited.has(resolvedId)) {
          return
        }

        const importer = getModuleImporter(moduleId, durations, currentModule)

        modulesById[resolvedId] ??= {
          selfTime: 0,
          totalTime: 0,
          transformTime: 0,
          external: durations.external,
          importer,
        }

        // only track if the current module imported this module,
        // otherwise it was imported instantly because it's cached
        if (importer === moduleId) {
          visited.add(resolvedId)
          modulesById[resolvedId].selfTime += durations.selfTime
          modulesById[resolvedId].totalTime += durations.totalTime

          // don't aggregate
          modulesById[resolvedId].transformTime = state.metadata[currentModule.project.name]?.duration[resolvedUrl]?.[0]
        }
      })
    }
  }

  // if module was imported twice in the same file,
  // show only one time - the second should be shown as 0
  const visitedInFile = new Set<string>()
  moduleDiagnostic.modules.forEach((diagnostic) => {
    const durations = modulesById[diagnostic.resolvedId]
    if (!durations) {
      return
    }

    if (visitedInFile.has(diagnostic.resolvedId)) {
      modules.push({
        ...diagnostic,
        selfTime: 0,
        totalTime: 0,
        transformTime: 0,
        external: durations.external,
        importer: durations.importer,
      })
    }
    else {
      visitedInFile.add(diagnostic.resolvedId)
      modules.push({
        ...diagnostic,
        ...durations,
      })
    }
  })
  const untracked: UntrackedModuleDefinitionDiagnostic[] = []
  moduleDiagnostic.untracked.forEach((diagnostic) => {
    const durations = modulesById[diagnostic.resolvedId]
    if (!durations) {
      return
    }

    if (visitedInFile.has(diagnostic.resolvedId)) {
      untracked.push({
        selfTime: 0,
        totalTime: 0,
        transformTime: 0,
        external: durations.external,
        importer: durations.importer,
        resolvedId: diagnostic.resolvedId,
        resolvedUrl: diagnostic.resolvedUrl,
        url: diagnostic.rawUrl,
      })
    }
    else {
      visitedInFile.add(diagnostic.resolvedId)
      untracked.push({
        ...durations,
        resolvedId: diagnostic.resolvedId,
        resolvedUrl: diagnostic.resolvedUrl,
        url: diagnostic.rawUrl,
      })
    }
  })

  return {
    modules,
    untrackedModules: untracked,
  }
}

function getModuleImporter(moduleId: string, durations: ImportDuration, testModule: TestModule): string | undefined {
  if (durations.importer === moduleId) {
    return moduleId
  }
  if (!durations.importer) {
    if (moduleId === testModule.moduleId) {
      return testModule.moduleId
    }

    const setupFiles = testModule.project.config.setupFiles
    return setupFiles.includes(moduleId)
      ? moduleId
      : durations.importer
  }
  return durations.importer
}

// the idea of this is very simple
// it parses the source code to extract import/export statements
// it parses SSR transformed file to extract __vite_ssr_import__ and __vite_ssr_dynamic_import__
// it combines the two by looking at the original positions of SSR primitives
// in the end, we are able to return a list of modules that were imported by this module
// mapped to their IDs in Vite's module graph
export async function collectSourceModulesLocations(
  moduleId: string,
  moduleGraph: EnvironmentModuleGraph,
): Promise<SourceModuleLocations | undefined> {
  const transformResult = moduleGraph.getModuleById(moduleId)?.transformResult
  if (!transformResult || !transformResult.ssr) {
    return
  }
  const map = transformResult.map
  if (!map || !('version' in map) || !map.sources.length) {
    return
  }

  const sourceImports = map.sources.reduce<Record<string, Map<string, SourceStaticImport>>>(
    (acc, sourceId, index) => {
      const source = map.sourcesContent?.[index]
      if (source != null) {
        acc[sourceId] = parseSourceImportsAndExports(source)
      }
      return acc
    },
    {},
  )

  const transformImports = await parseTransformResult(moduleGraph, transformResult)
  const traceMap = map && 'version' in map && new TraceMap(map as any)
  const modules: Record<string, ModuleDefinitionDiagnostic[]> = {}
  const untracked: ModuleDefinitionDiagnostic[] = []
  transformImports.forEach((row) => {
    const original = traceMap && originalPositionFor(traceMap, row.start)
    if (original && original.source != null) {
      // if there are several at the same position, this is a bug
      // probably caused by import.meta.glob imports returning incorrect positions
      // all the new import.meta.glob imports come first, so only the last module on this line is correct
      const sourceImport = sourceImports[original.source].get(`${original.line}:${original.column}`)
      if (sourceImport) {
        if (modules[sourceImport.rawUrl]) {
          // remove imports with a different resolvedId
          const differentImports = modules[sourceImport.rawUrl].filter(d => d.resolvedId !== row.resolvedId)
          untracked.push(...differentImports)
          modules[sourceImport.rawUrl] = modules[sourceImport.rawUrl].filter(d => d.resolvedId === row.resolvedId)
        }

        modules[sourceImport.rawUrl] ??= []
        modules[sourceImport.rawUrl].push({
          start: sourceImport.start,
          end: sourceImport.end,
          startIndex: sourceImport.startIndex,
          endIndex: sourceImport.endIndex,
          rawUrl: sourceImport.rawUrl,
          resolvedId: row.resolvedId,
          resolvedUrl: row.resolvedUrl,
        })
      }
    }
  })
  return {
    modules: Object.values(modules).flat(),
    untracked,
  }
}

interface SourceStaticImport {
  start: ModuleDefinitionLocation
  end: ModuleDefinitionLocation
  startIndex: number
  endIndex: number
  rawUrl: string
}

function fillSourcesMap(
  syntax: 'import' | 'export',
  sourcesMap: Map<string, SourceStaticImport>,
  source: string,
  indexMap: Map<number, ModuleDefinitionLocation>,
) {
  const splitSeparator = `${syntax} `
  const splitSources = source.split(splitSeparator)
  const chunks: {
    chunk: string
    startIndex: number
  }[] = []
  let index = 0
  for (const chunk of splitSources) {
    chunks.push({
      chunk,
      startIndex: index,
    })
    index += chunk.length + splitSeparator.length
  }

  chunks.forEach(({ chunk, startIndex }) => {
    const normalized = chunk.replace(/'/g, '"')
    const startQuoteIdx = normalized.indexOf('"')

    if (startQuoteIdx === -1) {
      return
    }
    const endQuoteIdx = normalized.indexOf('"', startQuoteIdx + 1)
    if (endQuoteIdx === -1) {
      return
    }

    const staticSyntax = {
      startIndex: startIndex + startQuoteIdx,
      endIndex: startIndex + endQuoteIdx + 1,
      start: indexMap.get(startIndex + startQuoteIdx)!,
      end: indexMap.get(startIndex + endQuoteIdx + 1)!,
      rawUrl: normalized.slice(startQuoteIdx + 1, endQuoteIdx),
    }

    // -7 to include "import "
    for (let i = startIndex - 7; i < staticSyntax.endIndex; i++) {
      const location = indexMap.get(i)!
      if (location) {
        sourcesMap.set(`${location.line}:${location.column}`, staticSyntax)
      }
    }
  })
}

// this function tries to parse ESM static import and export statements from
// the source. if the source is not JS/TS, but supports static ESM syntax,
// then this will also find them because it' only checks the strings, it doesn't parse the AST
function parseSourceImportsAndExports(source: string): Map<string, SourceStaticImport> {
  if (!source.includes('import ') && !source.includes('export ')) {
    return new Map()
  }
  const sourcesMap = new Map<string, SourceStaticImport>()
  const indexMap = createIndexLocationsMap(source)

  fillSourcesMap('import', sourcesMap, source, indexMap)
  fillSourcesMap('export', sourcesMap, source, indexMap)

  return sourcesMap
}

async function parseTransformResult(moduleGraph: EnvironmentModuleGraph, transformResult: TransformResult) {
  const code = transformResult.code
  const regexp = /(?:__vite_ssr_import__|__vite_ssr_dynamic_import__)\("([^"]+)"/g
  const lineColumnMap = createIndexLocationsMap(code)
  const importPositions: {
    raw: string
    startIndex: number
    endIndex: number
  }[] = []
  let match: RegExpMatchArray | null
  // eslint-disable-next-line no-cond-assign
  while (match = regexp.exec(code)) {
    const startIndex = match.index!
    const endIndex = match.index! + match[0].length - 1 // 1 is "
    importPositions.push({ raw: match[1], startIndex, endIndex })
  }

  const results = await Promise.all(importPositions.map(async ({ startIndex, endIndex, raw }) => {
    const position = lineColumnMap.get(startIndex)!
    const endPosition = lineColumnMap.get(endIndex)!
    const moduleNode = await moduleGraph.getModuleByUrl(raw)
    if (!position || !endPosition || !moduleNode || !moduleNode.id) {
      return
    }

    return {
      resolvedId: moduleNode.id,
      resolvedUrl: moduleNode.url,
      start: position,
      end: endPosition,
      startIndex,
      endIndex,
    }
  }))

  return results.filter(n => n != null)
}
