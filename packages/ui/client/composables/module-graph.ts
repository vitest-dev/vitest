import type { Graph, GraphConfig, GraphController, GraphLink, GraphNode } from 'd3-graph-controller'
import { defineGraph, defineLink, defineNode } from 'd3-graph-controller'
import type { ModuleGraphData } from '../../../vitest/src/types'

export type ModuleType = 'external' | 'inline'
export type ModuleNode = GraphNode<ModuleType>
export type ModuleLink = GraphLink<ModuleType, ModuleNode>
export type ModuleGraph = Graph<ModuleType, ModuleNode, ModuleLink>
export type ModuleGraphController = GraphController<ModuleType, ModuleNode, ModuleLink>
export type ModuleGraphConfig = GraphConfig<ModuleType, ModuleNode, ModuleLink>

function defineExternalModuleNode(module: string): ModuleNode {
  let label = module
  if (label.includes('/node_modules/'))
    label = label.split(/\/node_modules\//g).pop()!
  else
    label = label.split(/\//g).pop()!

  return defineNode<ModuleType, ModuleNode>({
    color: 'var(--color-node-external)',
    label: {
      color: 'var(--color-node-external)',
      fontSize: '0.875rem',
      text: label,
    },
    isFocused: false,
    id: module,
    type: 'external',
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

export function getModuleGraph(data: ModuleGraphData, rootPath: string | undefined): ModuleGraph {
  if (!data)
    return defineGraph({})

  const externalizedNodes = data.externalized.map(module => defineExternalModuleNode(module)) ?? []
  const inlinedNodes = data.inlined.map(module => defineInlineModuleNode(module, module === rootPath)) ?? []
  const nodes = [...externalizedNodes, ...inlinedNodes]
  const nodeMap = Object.fromEntries(nodes.map(node => [node.id, node]))
  const links = Object
    .entries(data.graph)
    .flatMap(([module, deps]) => deps.map((dep) => {
      const source = nodeMap[module]
      const target = nodeMap[dep]
      if (source === undefined || target === undefined)
        return undefined

      return defineLink({
        source,
        target,
        color: 'var(--color-link)',
        label: false,
      })
    }).filter(link => link !== undefined) as ModuleLink[])
  return defineGraph({ nodes, links })
}
