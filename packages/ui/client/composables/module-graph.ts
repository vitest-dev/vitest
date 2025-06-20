import type {
  Graph,
  GraphConfig,
  GraphController,
  GraphLink,
  GraphNode,
} from 'd3-graph-controller'
import type { ModuleGraphData } from 'vitest'
import { defineGraph, defineLink, defineNode } from 'd3-graph-controller'

export type ModuleType = 'external' | 'inline'
export type ModuleNode = GraphNode<ModuleType>
export type ModuleLink = GraphLink<ModuleType, ModuleNode>
export type ModuleGraph = Graph<ModuleType, ModuleNode, ModuleLink>
export type ModuleGraphController = GraphController<
  ModuleType,
  ModuleNode,
  ModuleLink
>
export type ModuleGraphConfig = GraphConfig<ModuleType, ModuleNode, ModuleLink>

export interface ModuleLabelItem {
  id: string
  raw: string
  splits: string[]
  candidate: string
  finished: boolean
}

export function calcExternalLabels(
  labels: ModuleLabelItem[],
): Map<string, string> {
  const result: Map<string, string> = new Map()
  const splitMap: Map<string, number[]> = new Map()
  const firsts: number[] = []
  while (true) {
    let finishedCount = 0
    labels.forEach((label, i) => {
      const { splits, finished } = label
      // record the candidate as final label text when label is marked finished
      if (finished) {
        finishedCount++
        const { raw, candidate } = label
        result.set(raw, candidate)
        return
      }
      if (splits.length === 0) {
        label.finished = true
        return
      }
      const head = splits[0]
      if (splitMap.has(head)) {
        label.candidate += label.candidate === '' ? head : `/${head}`
        splitMap.get(head)?.push(i)
        splits.shift()
      }
      else {
        splitMap.set(head, [i])
        // record the index of the label where the head first appears
        firsts.push(i)
      }
    })
    // update candidate of label which index appears in first array
    firsts.forEach((i) => {
      const label = labels[i]
      const head = label.splits.shift()
      label.candidate += label.candidate === '' ? head : `/${head}`
    })
    splitMap.forEach((value) => {
      if (value.length === 1) {
        const index = value[0]
        labels[index].finished = true
      }
    })
    splitMap.clear()
    firsts.length = 0
    if (finishedCount === labels.length) {
      break
    }
  }
  return result
}

export function createModuleLabelItem(module: string): ModuleLabelItem {
  let raw = module
  if (raw.includes('/node_modules/')) {
    raw = module.split(/\/node_modules\//g).pop()!
  }
  const splits = raw.split(/\//g)
  return {
    raw,
    splits,
    candidate: '',
    finished: false,
    id: module,
  }
}

function defineExternalModuleNodes(modules: string[]): ModuleNode[] {
  const labels: ModuleLabelItem[] = modules.map(module =>
    createModuleLabelItem(module),
  )
  const map = calcExternalLabels(labels)
  return labels.map(({ raw, id }) => {
    return defineNode<ModuleType, ModuleNode>({
      color: 'var(--color-node-external)',
      label: {
        color: 'var(--color-node-external)',
        fontSize: '0.875rem',
        text: map.get(raw) ?? '',
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
  data: ModuleGraphData,
  rootPath: string | undefined,
): ModuleGraph {
  if (!data) {
    return defineGraph({})
  }

  const externalizedNodes = defineExternalModuleNodes(data.externalized)
  const inlinedNodes
    = data.inlined.map(module =>
      defineInlineModuleNode(module, module === rootPath),
    ) ?? []
  const nodes = [...externalizedNodes, ...inlinedNodes]
  const nodeMap = Object.fromEntries(nodes.map(node => [node.id, node]))
  const links = Object.entries(data.graph).flatMap(
    ([module, deps]) =>
      deps
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
        .filter(link => link !== undefined) as ModuleLink[],
  )
  return defineGraph({ nodes, links })
}
