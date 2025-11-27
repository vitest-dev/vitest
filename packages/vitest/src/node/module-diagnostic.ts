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
  imports: ModuleImportDiagnostic[]
}

export interface ModuleDurationsDiagnostic {
  imports: ModuleImportDurationsDiagnostic[]
  // TODO: support exports
}

export function collectModuleDurationsDiagnostic(
  state: StateManager,
  moduleDiagnostic: ModuleDiagnostic,
  testModule?: TestModule,
): ModuleDurationsDiagnostic {
  const imports: ModuleImportDurationsDiagnostic[] = []
  const importsById: Record<string, {
    selfTime: number
    totalTime: number
    external?: boolean
  }> = {}
  for (const files of (testModule ? [[testModule.task]] : state.filesMap.values())) {
    for (const file of files) {
      const importDurations = file.importDurations
      if (!importDurations) {
        continue
      }
      moduleDiagnostic.imports.forEach((diagnostic) => {
        const durations = importDurations[diagnostic.resolvedId]
        if (durations) {
          importsById[diagnostic.resolvedId] ??= {
            selfTime: 0,
            totalTime: 0,
            external: durations.external,
          }
          importsById[diagnostic.resolvedId].selfTime += durations.selfTime
          importsById[diagnostic.resolvedId].totalTime += durations.totalTime
        }
      })
    }
  }
  moduleDiagnostic.imports.forEach((diagnostic) => {
    const durations = importsById[diagnostic.resolvedId]
    if (durations) {
      imports.push({
        ...diagnostic,
        ...durations,
      })
    }
  })
  return {
    imports,
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
    // console.log('no map', map)
    return
  }
  const sourceImports = map.sources.reduce((acc, sourceId, index) => {
    const source = map.sourcesContent?.[index]
    if (source != null) {
      acc[sourceId] = parseSourceImports(source)
    }
    return acc
  }, {} as Record<string, Map<string, SourceStaticImport>>)
  const transformImports = await parseTransformResult(moduleGraph, transformResult)
  // console.log(sourceImports, transformImports)
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
    imports,
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

function parseSourceImports(source: string): Map<string, SourceStaticImport> {
  if (!source.includes('import ')) {
    return new Map()
  }
  const sourcesMap = new Map<string, SourceStaticImport>()
  const indexMap = createIndexMap(source)
  const splitSources = source.split('import ')
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
    index += chunk.length + 7 // 'import '.length
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

    const staticImport = {
      startIndex: startIndex + startQuoteIdx,
      endIndex: startIndex + endQuoteIdx + 1,
      start: indexMap.get(startIndex + startQuoteIdx)!,
      end: indexMap.get(startIndex + endQuoteIdx + 1)!,
      url: normalized.slice(startQuoteIdx + 1, endQuoteIdx),
    }

    // -7 to include "import "
    for (let i = startIndex - 7; i < staticImport.endIndex; i++) {
      const location = indexMap.get(i)!
      if (location) {
        sourcesMap.set(`${location.line}:${location.column}`, staticImport)
      }
    }
  })

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
  const map = new Map<number, { line: number; column: number }>()
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
