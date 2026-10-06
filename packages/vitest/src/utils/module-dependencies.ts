import type { EvaluatedModules } from 'vite/module-runner'

/**
 * Ids of the roots and of every module reachable from them through the runtime import edges.
 */
export function collectEvaluatedDependencies(
  evaluatedModules: EvaluatedModules,
  ...roots: Iterable<string>[]
): string[] {
  const visited = new Set<string>()
  const queue: string[] = []
  for (const ids of roots) {
    for (const id of ids) {
      if (!visited.has(id)) {
        visited.add(id)
        queue.push(id)
      }
    }
  }
  while (queue.length) {
    const node = evaluatedModules.getModuleById(queue.pop()!)
    node?.imports.forEach((id) => {
      if (!visited.has(id)) {
        visited.add(id)
        queue.push(id)
      }
    })
  }
  return Array.from(visited)
}
