<script setup lang="ts">
import type { ResizeContext } from 'd3-graph-controller'
import type { Selection } from 'd3-selection'
import type {
  ModuleGraph,
  ModuleGraphController,
  ModuleLink,
  ModuleNode,
  ModuleType,
} from '~/composables/module-graph'
import { useRefHistory } from '@vueuse/core'
import {
  defineGraphConfig,
  defineNode,
  GraphController,
  Markers,
  PositionInitializers,
} from 'd3-graph-controller'
import { computed, onMounted, onUnmounted, ref, shallowRef, toRefs, watch } from 'vue'
import { config, isReport } from '~/composables/client'
import { currentModule } from '~/composables/navigation'
import IconButton from '../IconButton.vue'
import Modal from '../Modal.vue'
import ViewModuleGraphImportBreakdown from '../ModuleGraphImportBreakdown.vue'
import ModuleTransformResultView from '../ModuleTransformResultView.vue'

const props = defineProps<{
  graph: ModuleGraph
  projectName: string
}>()

const hideNodeModules = defineModel<boolean>({ required: true })

const { graph } = toRefs(props)

const el = ref<HTMLDivElement>()

const modalShow = ref(false)
const selectedModule = ref<{ id: string; type: ModuleType } | null>()
const selectedModuleHistory = useRefHistory(selectedModule)
const controller = ref<ModuleGraphController | undefined>()
const focusedNode = ref<string | null>(null)
const filteredGraph = shallowRef<ModuleGraph>(graph.value)
const breakdownIconClass = computed(() => {
  let textClass = ''
  const importDurations = currentModule.value?.importDurations
  const thresholds = config.value.experimental?.importDurations.thresholds
  if (!importDurations || !thresholds) {
    return textClass
  }
  for (const moduleId in importDurations) {
    const { totalTime } = importDurations[moduleId]
    if (totalTime >= thresholds.danger) {
      textClass = 'text-red'
      break
    }
    else if (totalTime >= thresholds.warn) {
      textClass = 'text-orange'
    }
  }
  return textClass
})
const breakdownShow = ref(breakdownIconClass.value === 'text-red')

onMounted(() => {
  filteredGraph.value = filterGraphByLevels(graph.value, null, 2)
  resetGraphController()
})

onUnmounted(() => {
  controller.value?.shutdown()
})

watch(graph, () => {
  filteredGraph.value = filterGraphByLevels(graph.value, focusedNode.value, 2)
  resetGraphController()
})

function showFullGraph() {
  filteredGraph.value = graph.value
  resetGraphController()
}

function toggleImportBreakdown() {
  breakdownShow.value = !breakdownShow.value
}

function filterGraphByLevels(
  sourceGraph: ModuleGraph,
  startNodeId: string | null,
  levels: number = 2,
): ModuleGraph {
  if (!sourceGraph.nodes.length || sourceGraph.nodes.length <= 50) {
    return sourceGraph
  }

  // Build adjacency list for efficient traversal
  const adjacencyList = new Map<string, Set<string>>()
  sourceGraph.nodes.forEach(node => adjacencyList.set(node.id, new Set()))

  sourceGraph.links.forEach((link) => {
    const sourceId = typeof link.source === 'object' ? link.source.id : String(link.source)
    const targetId = typeof link.target === 'object' ? link.target.id : String(link.target)
    adjacencyList.get(sourceId)?.add(targetId)
    adjacencyList.get(targetId)?.add(sourceId)
  })

  let startNodes: string[]
  if (startNodeId) {
    startNodes = [startNodeId]
  }
  else {
    // Find root node (node with type 'inline' that appears as source but not target, or first inline node)
    const targetIds = new Set(sourceGraph.links.map(link =>
      typeof link.target === 'object' ? link.target.id : String(link.target),
    ))
    const rootCandidates = sourceGraph.nodes.filter(
      node => node.type === 'inline' && !targetIds.has(node.id),
    )
    startNodes = rootCandidates.length > 0
      ? [rootCandidates[0].id]
      : [sourceGraph.nodes[0].id]
  }

  // BFS to find all nodes within N levels
  const visitedNodes = new Set<string>()
  const queue: Array<{ id: string; level: number }> = startNodes.map(id => ({ id, level: 0 }))

  while (queue.length > 0) {
    const { id, level } = queue.shift()!

    if (visitedNodes.has(id) || level > levels) {
      continue
    }

    visitedNodes.add(id)

    if (level < levels) {
      const neighbors = adjacencyList.get(id) || new Set()
      neighbors.forEach((neighborId) => {
        if (!visitedNodes.has(neighborId)) {
          queue.push({ id: neighborId, level: level + 1 })
        }
      })
    }
  }

  const nodeMap = new Map(sourceGraph.nodes.map(node => [node.id, node]))
  const filteredNodes = Array.from(visitedNodes)
    .map(id => nodeMap.get(id))
    .filter(node => node !== undefined) as ModuleNode[]

  const filteredNodeMap = new Map(filteredNodes.map(node => [node.id, node]))

  const filteredLinks = sourceGraph.links
    .map((link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : String(link.source)
      const targetId = typeof link.target === 'object' ? link.target.id : String(link.target)

      // Only include links where both nodes are in the filtered set
      if (visitedNodes.has(sourceId) && visitedNodes.has(targetId)) {
        const sourceNode = filteredNodeMap.get(sourceId)
        const targetNode = filteredNodeMap.get(targetId)

        if (sourceNode && targetNode) {
          return {
            ...link,
            source: sourceNode,
            target: targetNode,
          }
        }
      }
      return null
    })
    .filter(link => link !== null) as ModuleLink[]

  return {
    nodes: filteredNodes,
    links: filteredLinks,
  }
}

function setFilter(name: ModuleType, value: boolean) {
  controller.value?.filterNodesByType(value, name)
}

function setSelectedModule(id: string, type: ModuleType) {
  selectedModule.value = { id, type }
  modalShow.value = true
}

function selectPreviousModule() {
  selectedModuleHistory.undo()
}

function closeResultView() {
  modalShow.value = false
  selectedModuleHistory.clear()
}

function focusOnNode(nodeId: string) {
  focusedNode.value = nodeId
  filteredGraph.value = filterGraphByLevels(graph.value, nodeId, 2)
  updateNodeColors()
  resetGraphController()
}

function resetToRoot() {
  focusedNode.value = null
  filteredGraph.value = filterGraphByLevels(graph.value, null, 2)
  updateNodeColors()
  resetGraphController()
}

function updateNodeColors() {
  const updatedNodes = filteredGraph.value.nodes.map((node) => {
    let color: string
    let labelColor: string

    if (node.id === focusedNode.value) {
      color = 'var(--color-node-focused)'
      labelColor = 'var(--color-node-focused)'
    }
    else if (node.type === 'inline') {
      const originalColor = node.color
      const isRoot = originalColor === 'var(--color-node-root)'
      color = isRoot ? 'var(--color-node-root)' : 'var(--color-node-inline)'
      labelColor = color
    }
    else {
      color = 'var(--color-node-external)'
      labelColor = 'var(--color-node-external)'
    }

    return defineNode<ModuleType, ModuleNode>({
      ...node,
      color,
      label: node.label
        ? {
            ...node.label,
            color: labelColor,
          }
        : node.label,
    })
  })

  const nodeMap = new Map(updatedNodes.map(node => [node.id, node]))

  const updatedLinks = filteredGraph.value.links.map((link) => {
    const sourceId = typeof link.source === 'object' ? link.source.id : String(link.source)
    const targetId = typeof link.target === 'object' ? link.target.id : String(link.target)

    return {
      ...link,
      source: nodeMap.get(sourceId)!,
      target: nodeMap.get(targetId)!,
    }
  })

  filteredGraph.value = {
    nodes: updatedNodes,
    links: updatedLinks,
  }
}

function resetGraphController(reset = false) {
  controller.value?.shutdown()

  // Force reload the module graph only when node_modules are shown.
  // The module graph doesn't contain node_modules entries.
  if (reset && !hideNodeModules.value) {
    hideNodeModules.value = true
    return
  }

  if (!filteredGraph.value || !el.value) {
    return
  }

  const nodesLength = filteredGraph.value.nodes.length
  let zoom = 1
  let min = 0.5
  if (nodesLength > 300) {
    zoom = 0.3
    min = 0.2
  }
  else if (nodesLength > 200) {
    zoom = 0.4
    min = 0.3
  }
  else if (nodesLength > 100) {
    zoom = 0.5
    min = 0.3
  }
  else if (nodesLength > 50) {
    zoom = 0.7
    zoom = 0.4
  }

  controller.value = new GraphController(
    el.value!,
    filteredGraph.value,
    // See https://graph-controller.yeger.eu/config/ for more options
    defineGraphConfig<ModuleType, ModuleNode, ModuleLink>({
      nodeRadius: 10,
      autoResize: true,
      simulation: {
        alphas: {
          initialize: 1,
          resize: ({ newHeight, newWidth }: ResizeContext) => {
            const willBeHidden = newHeight === 0 && newWidth === 0
            if (willBeHidden) {
              return 0
            }
            return 0.05
          },
        },
        forces: {
          collision: {
            radiusMultiplier: 10,
          },
          link: {
            length: 140,
          },
        },
      },
      marker: Markers.Arrow(2),
      modifiers: {
        node: bindOnClick,
      },
      positionInitializer: graph.value.nodes.length === 1
        ? PositionInitializers.Centered
        : PositionInitializers.Randomized,
      zoom: {
        initial: zoom,
        min,
        max: 1.5,
      },
    }),
  )
}

const isValidClick = (event: PointerEvent) => event.button === 0
const isRightClick = (event: PointerEvent) => event.button === 2

function bindOnClick(
  selection: Selection<SVGCircleElement, ModuleNode, SVGGElement, undefined>,
) {
  if (isReport) {
    return
  }
  // Handle both left-click (focus) and right-click (open modal)
  let px = 0
  let py = 0
  let pt = 0
  let isRightClickDown = false

  selection
    .on('pointerdown', (event: PointerEvent, node) => {
      if (!node.x || !node.y) {
        return
      }

      isRightClickDown = isRightClick(event)

      if (!isValidClick(event) && !isRightClickDown) {
        return
      }

      px = node.x
      py = node.y
      pt = Date.now()
    })
    .on('pointerup', (event: PointerEvent, node: ModuleNode) => {
      if (!node.x || !node.y) {
        return
      }

      const wasRightClick = isRightClick(event)

      if (!isValidClick(event) && !wasRightClick) {
        return
      }

      if (Date.now() - pt > 500) {
        return
      }

      const dx = node.x - px
      const dy = node.y - py
      if (dx ** 2 + dy ** 2 < 100) {
        // Left-click: show details (open modal)
        if (!wasRightClick && !event.shiftKey) {
          setSelectedModule(node.id, node.type)
        }
        // Right-click or Shift+Click: expand graph (focus on node)
        else if (wasRightClick || event.shiftKey) {
          event.preventDefault()
          if (node.type === 'inline') {
            focusOnNode(node.id)
          }
        }
      }
    })
    .on('contextmenu', (event: PointerEvent) => {
      // Prevent default context menu
      event.preventDefault()
    })
}
</script>

<template>
  <div h-full min-h-75 flex-1 overflow="hidden">
    <div>
      <div flex items-center gap-2 px-3 py-2>
        <div
          flex="~ gap-1"
          items-center
          select-none
        >
          <div class="pr-2">
            {{ filteredGraph.nodes.length }}/{{ graph.nodes.length }} {{ filteredGraph.nodes.length === 1 ? 'module' : 'modules' }}
          </div>
          <input
            id="hide-node-modules"
            v-model="hideNodeModules"
            type="checkbox"
          >
          <label
            font-light
            text-sm
            ws-nowrap
            overflow-hidden
            select-none
            truncate
            for="hide-node-modules"
            border-b-2
            border="$cm-namespace"
          >Hide node_modules</label>
        </div>
        <div
          v-for="node of controller?.nodeTypes.sort()"
          :key="node"
          flex="~ gap-1"
          items-center
          select-none
        >
          <input
            :id="`type-${node}`"
            type="checkbox"
            :checked="controller?.nodeTypeFilter.includes(node)"
            @change="setFilter(node, ($event as any).target.checked)"
          >
          <label
            font-light
            text-sm
            ws-nowrap
            overflow-hidden
            capitalize
            select-none
            truncate
            :for="`type-${node}`"
            border-b-2
            :style="{ 'border-color': `var(--color-node-${node})` }"
          >{{ node }} Modules</label>
        </div>
        <div flex-auto />
        <div
          flex="~ gap-2"
          items-center
          text-xs
          opacity-60
        >
          <span>Click on node: details • Right-click/Shift: expand graph</span>
        </div>
        <div>
          <IconButton
            v-tooltip.bottom="`${breakdownShow ? 'Hide' : 'Show'} Import Breakdown`"
            icon="i-carbon-notebook"
            :class="breakdownIconClass"
            @click="toggleImportBreakdown()"
          />
        </div>
        <div>
          <IconButton
            v-tooltip.bottom="'Show Full Graph'"
            icon="i-carbon-ibm-cloud-direct-link-2-connect"
            @click="showFullGraph()"
          />
        </div>
        <div>
          <IconButton
            v-tooltip.bottom="'Reset'"
            icon="i-carbon-reset"
            @click="resetToRoot()"
          />
        </div>
      </div>
    </div>
    <div v-if="breakdownShow" class="absolute bg-[#eee] dark:bg-[#222] border-base right-0 mr-2 rounded-xl mt-2">
      <ViewModuleGraphImportBreakdown @select="(id, type) => setSelectedModule(id, type)" />
    </div>
    <div ref="el" />
    <Modal v-model="modalShow" direction="right">
      <template v-if="selectedModule">
        <Suspense>
          <ModuleTransformResultView
            :id="selectedModule.id"
            :project-name="projectName"
            :type="selectedModule.type"
            :can-undo="selectedModuleHistory.undoStack.value.length > 1"
            @close="closeResultView()"
            @select="(id, type) => setSelectedModule(id, type)"
            @back="selectPreviousModule()"
          />
        </Suspense>
      </template>
    </Modal>
  </div>
</template>

<style>
:root {
  --color-link-label: var(--color-text);
  --color-link: #ddd;
  --color-node-external: #6C5C33;
  --color-node-inline: #8bc4a0;
  --color-node-root: #6e9aa5;
  --color-node-focused: #e67e22;
  --color-node-label: var(--color-text);
  --color-node-stroke: var(--color-text);
}

html.dark {
  --color-text: #fff;
  --color-link: #333;
  --color-node-external: #c0ad79;
  --color-node-inline: #468b60;
  --color-node-root: #467d8b;
  --color-node-focused: #f39c12;
}

.graph {
  /* The graph container is offset in its parent. Thus we can't use the default 100% height and have to subtract the offset. */
  height: calc(100% - 39px) !important;
}

.graph .node {
  stroke-width: 2px;
  stroke-opacity: 0.5;
}

.graph .link {
  stroke-width: 2px;
}

.graph .node:hover:not(.focused) {
  filter: none !important;
}

.graph .node__label {
  transform: translateY(20px);
  font-weight: 100;
  filter: brightness(0.5);
}

html.dark .graph .node__label {
  filter: brightness(1.2);
}
</style>
