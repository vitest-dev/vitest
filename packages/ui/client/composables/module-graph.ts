import type { Graph, GraphController, GraphLink, GraphNode } from 'd3-graph-controller'
import type { ModuleGraphData } from 'vitest'
import { defineGraph, defineLink, defineNode } from 'd3-graph-controller'
import { calcExternalLabels, createModuleLabelItem } from '~/utils/task'
import { config } from './client'

export type ModuleType = 'external' | 'inline'
export type ModuleNode = GraphNode<ModuleType>
export type ModuleLink = GraphLink<ModuleType, ModuleNode>
export type ModuleGraph = Graph<ModuleType, ModuleNode, ModuleLink>
export type ModuleGraphController = GraphController<ModuleType, ModuleNode, ModuleLink>

const NODE_MODULES_RE = /[/\\]node_modules[/\\]/

function defineExternalModuleNodes(modules: string[]): ModuleNode[] {
  const labels = modules.map((module) => createModuleLabelItem(module))
  const map = calcExternalLabels(labels)
  return labels.map(({ raw, id, splitsCopy }) => {
    return defineNode<ModuleType, ModuleNode>({
      color: 'var(--color-node-external)',
      label: {
        color: 'var(--color-node-external)',
        fontSize: '0.875rem',
        text: id.includes('node_modules') ? (map.get(raw) ?? raw) : splitsCopy.at(-1)!,
      },
      isFocused: false,
      id,
      type: 'external',
    })
  })
}

function defineInlineModuleNode(module: string, isRoot: boolean): ModuleNode {
  return defineNode<ModuleType, ModuleNode>({
    color: isRoot ? 'var(--color-node-root)' : 'var(--color-node-inline)',
    label: {
      color: isRoot ? 'var(--color-node-root)' : 'var(--color-node-inline)',
      fontSize: '0.875rem',
      text: module.split(/\//g).pop()!,
    },
    isFocused: false,
    id: module,
    type: 'inline',
  })
}

export function getModuleGraph(
  data: ModuleGraphData | undefined,
  rootPath: string | undefined,
  hideNodeModules = false,
): ModuleGraph {
  if (!data) {
    return defineGraph({})
  }

  const inlined: string[] = []
  const externalized: string[] = []
  const seen = new Set<string>()
  function visit(id: string) {
    const module = data!.modules[id]
    if (seen.has(id) || !module) {
      return
    }
    seen.add(id)
    if (module.external) {
      externalized.push(id)
      return
    }
    inlined.push(id)
    module.imports.forEach(visit)
  }
  data.roots.forEach(visit)

  const isVisible = (id: string) => !hideNodeModules || !NODE_MODULES_RE.test(id)
  const visibleInlined = inlined.filter(isVisible)
  const visibleExternalized = externalized.filter(isVisible)
  const externalizedNodes = !config.value.experimental?.viteModuleRunner
    ? defineExternalModuleNodes([...visibleInlined, ...visibleExternalized])
    : defineExternalModuleNodes(visibleExternalized)
  const inlinedNodes = !config.value.experimental?.viteModuleRunner
    ? []
    : visibleInlined.map((module) => defineInlineModuleNode(module, module === rootPath))
  const nodes = [...externalizedNodes, ...inlinedNodes]
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]))
  const links = inlined.flatMap(
    (module) =>
      data.modules[module].imports
        .map((dep) => {
          const source = nodeMap[module]
          const target = nodeMap[dep]
          if (source === undefined || target === undefined) {
            return undefined
          }

          return defineLink({
            source,
            target,
            color: 'var(--color-link)',
            label: false,
          })
        })
        .filter((link) => link !== undefined) as ModuleLink[],
  )
  return defineGraph({ nodes, links })
}
