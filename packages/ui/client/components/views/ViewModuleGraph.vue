<script setup lang="ts">
import type { ResizeContext } from 'd3-graph-controller'
import { GraphController, PositionInitializers, defineGraphConfig } from 'd3-graph-controller'
import type { Selection } from 'd3-selection'
import type { ModuleGraph, ModuleGraphController, ModuleLink, ModuleNode, ModuleType } from '~/composables/module-graph'

const props = defineProps<{
  graph: ModuleGraph
}>()

const { graph } = toRefs(props)

const el = ref<HTMLDivElement>()

const modalShow = ref(false)
const selectedModule = ref<string | null>()
const controller = ref<ModuleGraphController | undefined>()

useResizeObserver(el, debounce(() => {
  controller.value?.resize()
}))

onMounted(() => {
  resetGraphController()
})

onUnmounted(() => {
  controller.value?.shutdown()
})

watch(graph, resetGraphController)

function setFilter(name: ModuleType, value: boolean) {
  controller.value?.filterNodesByType(value, name)
}

function setSelectedModule(id: string) {
  selectedModule.value = id
  modalShow.value = true
}

function resetGraphController() {
  controller.value?.shutdown()
  if (!graph.value || !el.value)
    return

  controller.value = new GraphController(
    el.value!,
    graph.value,
    defineGraphConfig<ModuleType, ModuleNode, ModuleLink>({
      getLinkLength: () => 120,
      getNodeRadius: () => 10,
      alphas: {
        initialize: graph.value.nodes.some(node => node.x === undefined || node.y === undefined) ? 1 : 0,
        resize: ({ newHeight, newWidth }: ResizeContext) => {
          const willBeHidden = newHeight === 0 && newWidth === 0
          if (willBeHidden)
            return 0
          return 0.25
        },
      },
      callbacks: {
        nodeClicked(node: ModuleNode) {
          setSelectedModule(node.id)
        },
      },
      forces: {
        charge: {
          strength: -1,
        },
        collision: {
          radiusMultiplier: 2,
        },
      },
      // TODO: pointerup triggers when drag ends
      // modifiers: {
      //   node(selection: Selection<SVGCircleElement, ModuleNode, SVGGElement, undefined>) {
      //     selection
      //       .on('pointerdown', null)
      //       .on('pointerup', (_: PointerEvent, node: ModuleNode) => setSelectedModule(node.id))
      //   },
      // },
      positionInitializer: graph.value.nodes.length > 1
        ? PositionInitializers.Randomized
        : PositionInitializers.Centered,
    }),
  )
}

// Without debouncing the resize method, resizing the component will result in flickering.
function debounce(cb: () => void) {
  let h = 0
  return () => {
    window.clearTimeout(h)
    h = window.setTimeout(() => cb())
  }
}
</script>

<template>
  <div h-full overflow="hidden">
    <div>
      <div flex items-center gap-4 px-3 py-2>
        <div v-for="node of controller?.nodeTypes.sort()" :key="node" flex="~ gap-1" items-center select-none>
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
            truncate :for="`type-${node}`"
            border-b-2
            :style="{ 'border-color': `var(--color-node-${node})`}"
          >
            {{ node }} Modules
          </label>
        </div>
        <div flex-auto />
        <div>
          <IconButton
            icon="i-carbon-reset"
            :onclick="resetGraphController"
          />
        </div>
      </div>
    </div>
    <div ref="el" class="graph" />
    <Modal v-model="modalShow" direction="right">
      <template v-if="selectedModule">
        <Suspense>
          <ModuleTransformResultView :id="selectedModule" @close="modalShow=false" />
        </Suspense>
      </template>
    </Modal>
  </div>
</template>

<style>
:root {
  --color-link-label: var(--color-text);
  --color-link: #ddd;
  --color-node-external: #c0ad79;
  --color-node-inline: #8bc4a0;
  --color-node-root: #6e9aa5;
  --color-node-label: var(--color-text);
  --color-node-stroke: var(--color-text);
  --graph-h: calc(100vh - 78px - 39px);
}

html.dark {
  --color-text: #fff;
  --color-link: #333;
  --color-node-external: #857a40;
  --color-node-inline: #468b60;
  --color-node-root: #467d8b;
}

.graph {
  min-height: var(--graph-h) !important;
  max-height: var(--graph-h) !important;
  height: var(--graph-h) !important;
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
