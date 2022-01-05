import type { Graph, GraphConfig, GraphController, GraphLink, GraphNode } from 'd3-graph-controller'
import { defineLink, defineNode } from 'd3-graph-controller'
import type { Ref } from 'vue'

export type ModuleType = 'external' | 'inline'
export type ModuleNode = GraphNode<ModuleType>
export type ModuleLink = GraphLink<ModuleType, ModuleNode>
export type ModuleGraph = Graph<ModuleType, ModuleNode, ModuleLink>
export type ModuleGraphController = GraphController<ModuleType, ModuleNode, ModuleLink>
export type ModuleGraphConfig = GraphConfig<ModuleType, ModuleNode, ModuleLink>

function makeLabel(module: string): string {
  return module.substring(module.lastIndexOf('/') + 1)
}

function defineExternalModuleNode(module: string): ModuleNode {
  return defineNode<ModuleType, ModuleNode>({
    color: 'var(--color-node-external)',
    labelColor: 'var(--color-node-external)',
    fontSize: '0.875rem',
    isFocused: false,
    id: module,
    label: makeLabel(module),
    type: 'external',
  })
}

function defineInlineModuleNode(module: string): ModuleNode {
  return defineNode<ModuleType, ModuleNode>({
    color: 'var(--color-node-inline)',
    labelColor: 'var(--color-node-inline)',
    fontSize: '0.875rem',
    isFocused: false,
    id: module,
    label: makeLabel(module),
    type: 'inline',
  })
}

export function useModuleGraph(data: Ref<{
  graph: Record<string, string[]>
  externalized: string[]
  inlined: string[]
}>, rootPath: Ref<string | undefined>): Ref<ModuleGraph> {
  return computed(() => {
    if (!data.value) {
      return {
        nodes: [],
        links: [],
      }
    }
    const externalizedNodes = data.value.externalized.map(module => defineExternalModuleNode(module)) ?? []
    const inlinedNodes = data.value.inlined.map(module => defineInlineModuleNode(module)) ?? []
    const nodes = [...externalizedNodes, ...inlinedNodes]
    const rootNode = nodes.find(i => i.id === rootPath.value)
    if (rootNode) {
      rootNode.color = 'var(--color-node-root)'
      rootNode.labelColor = 'var(--color-node-root)'
    }
    const nodeMap = Object.fromEntries(nodes.map(node => [node.id, node]))
    const links = Object
      .entries(data.value.graph)
      .flatMap(([module, deps]) => deps.map((dep) => {
        const source = nodeMap[module]
        const target = nodeMap[dep]

        return defineLink({
          source,
          target,
          color: 'var(--color-link)',
          label: '',
          labelColor: 'var(--color-link-label)',
          showLabel: false,
        })
      }))
    return { nodes, links }
  })
}
