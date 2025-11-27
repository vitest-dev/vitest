import type { EnvironmentModuleGraph, TransformResult } from 'vite'
import type { TestModule } from './reporters/reported-tasks'
import type { StateManager } from './state'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'

interface ModuleImportDiagnostic {
  start: Location
  end: Location
  startIndex: number
  endIndex: number
  url: string
  resolvedId: string
}

export interface ModuleImportDurationsDiagnostic extends ModuleImportDiagnostic {
  selfTime: number
  totalTime: number
  external?: boolean
}

interface ModuleDiagnostic {
  modules: ModuleImportDiagnostic[]
}

export interface ModuleDurationsDiagnostic {
  modules: ModuleImportDurationsDiagnostic[]
  // TODO: support exports
}

export function collectModuleDurationsDiagnostic(
  moduleId: string,
  state: StateManager,
  moduleDiagnostic: ModuleDiagnostic,
  testModule?: TestModule,
): ModuleDurationsDiagnostic {
  const modules: ModuleImportDurationsDiagnostic[] = []
  const modulesById: Record<string, {
    selfTime: number
    totalTime: number
    external?: boolean
  }> = {}
  // this aggregates the times for _ALL_ tests if testModule is not passed
  // so if the module was imported in separate tests, the time will be accumulated
  for (const files of (testModule ? [[testModule.task]] : state.filesMap.values())) {
    for (const file of files) {
      const importDurations = file.importDurations
      if (!importDurations) {
        continue
      }
      moduleDiagnostic.modules.forEach((diagnostic) => {
        const durations = importDurations[diagnostic.resolvedId]
        if (durations) {
          // TODO: if not isolated, do it only once, because the times are not accumulated

          modulesById[diagnostic.resolvedId] ??= {
            selfTime: 0,
            totalTime: 0,
            external: durations.external,
          }

          // only track if the current module imported this module,
          // otherwise it was imported instantly because it's cached
          if (durations.importer === moduleId) {
            modulesById[diagnostic.resolvedId].selfTime += durations.selfTime
            modulesById[diagnostic.resolvedId].totalTime += durations.totalTime
          }
        }
      })
    }
  }
  moduleDiagnostic.modules.forEach((diagnostic) => {
    const durations = modulesById[diagnostic.resolvedId]
    if (durations) {
      modules.push({
        ...diagnostic,
        ...durations,
      })
    }
  })
  return {
    modules,
  }
}

export async function collectModuleDiagnostic(
  moduleGraph: EnvironmentModuleGraph,
  transformResult: TransformResult, // with ssr transform
): Promise<ModuleDiagnostic | undefined> {
  if (!transformResult.ssr) {
    return
  }
  const map = transformResult.map
  if (!map || !('version' in map) || !map.sources.length) {
    return
  }
  const sourceImports = map.sources.reduce((acc, sourceId, index) => {
    const source = map.sourcesContent?.[index]
    if (source != null) {
      acc[sourceId] = parseSourceImportsAndExports(source)
    }
    return acc
  }, {} as Record<string, Map<string, SourceStaticImport>>)
  const transformImports = await parseTransformResult(moduleGraph, transformResult)
  const traceMap = map && 'version' in map && new TraceMap(map as any)
  const imports: ModuleImportDiagnostic[] = []
  transformImports.forEach((row) => {
    const original = traceMap && originalPositionFor(traceMap, row.start)
    if (original && original.source != null) {
      const sourceImport = sourceImports[original.source].get(`${original.line}:${original.column}`)
      if (sourceImport) {
        imports.push({
          start: sourceImport.start,
          end: sourceImport.end,
          startIndex: sourceImport.startIndex,
          endIndex: sourceImport.endIndex,
          url: sourceImport.url,
          resolvedId: row.resolvedId,
        })
      }
    }
  })
  return {
    modules: imports,
  }
}

interface Location {
  line: number
  column: number
}

interface SourceStaticImport {
  start: Location
  end: Location
  startIndex: number
  endIndex: number
  url: string
}

function fillSourcesMap(
  syntax: 'import' | 'export',
  sourcesMap: Map<string, SourceStaticImport>,
  source: string,
  indexMap: Map<number, Location>,
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
      url: normalized.slice(startQuoteIdx + 1, endQuoteIdx),
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

function parseSourceImportsAndExports(source: string): Map<string, SourceStaticImport> {
  if (!source.includes('import ') && !source.includes('export ')) {
    return new Map()
  }
  const sourcesMap = new Map<string, SourceStaticImport>()
  const indexMap = createIndexMap(source)

  fillSourcesMap('import', sourcesMap, source, indexMap)
  fillSourcesMap('export', sourcesMap, source, indexMap)

  return sourcesMap
}

async function parseTransformResult(moduleGraph: EnvironmentModuleGraph, transformResult: TransformResult) {
  const code = transformResult.code
  const regexp = /__vite_ssr_import__\("([^"]+)"/g
  const results: {
    resolvedId: string
    start: Location
    end: Location
    startIndex: number
    endIndex: number
  }[] = []
  const lineColumnMap = createIndexMap(code)
  let match: RegExpMatchArray | null
  // eslint-disable-next-line no-cond-assign
  while (match = regexp.exec(code)) {
    const startIndex = match.index!
    const endIndex = match.index! + match[0].length - 1 // 1 is "
    const position = lineColumnMap.get(startIndex)!
    const endPosition = lineColumnMap.get(endIndex)!
    const moduleNode = await moduleGraph.getModuleByUrl(match[1])
    if (!position || !endPosition || !moduleNode || !moduleNode.id) {
      continue
    }
    results.push({
      resolvedId: moduleNode.id,
      start: position,
      end: endPosition,
      startIndex,
      endIndex,
    })
  }
  return results
}

// TODO: utils, share with ast-collect
function createIndexMap(source: string) {
  const map = new Map<number, Location>()
  let index = 0
  let line = 1
  let column = 1
  for (const char of source) {
    map.set(index++, { line, column })
    if (char === '\n' || char === '\r\n') {
      line++
      column = 0
    }
    else {
      column++
    }
  }
  return map
}
