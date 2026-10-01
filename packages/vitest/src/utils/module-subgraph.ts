import type { ModuleGraphData } from '../types/general'

export function getModuleSubgraph(data: ModuleGraphData, roots: string[]): ModuleGraphData {
  const result: ModuleGraphData = { graph: {}, externalized: [], inlined: [] }
  const seen = new Set<string>()
  function visit(id: string) {
    if (seen.has(id)) {
      return
    }
    seen.add(id)
    const imported = data.graph[id]
    if (!imported) {
      result.externalized.push(id)
      return
    }
    result.inlined.push(id)
    imported.forEach(visit)
    result.graph[id] = imported
  }
  roots.forEach(visit)
  return result
}
