<script setup lang="ts">
import { GraphController } from 'd3-graph-controller'
import type { ModuleGraph, ModuleGraphController, ModuleType } from '~/composables/module-graph'
import { useModuleGraphConfig } from '~/composables/module-graph'

const props = defineProps<{
  graph: ModuleGraph
}>()

const { graph } = toRefs(props)

const el = ref<HTMLDivElement>()
const graphContainerRef = ref(null)
const style = ref<string | null>(null)

const config = useModuleGraphConfig(graph)
const controller = ref<ModuleGraphController | undefined>()

useResizeObserver(el, debounce(() => {
  controller.value?.resize()
}))

useResizeObserver(graphContainerRef, () => {
  const clientWidth = unrefElement(graphContainerRef)?.clientWidth
  style.value = clientWidth ? `--graph-w: ${clientWidth}` : null
})

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

function resetGraphController() {
  controller.value?.shutdown()
  if (graph.value && el.value) {
    controller.value = new GraphController(
      el.value!,
      graph.value,
      config.value,
    )
  }
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
  <div ref="graphContainer" h-full w-full overflow="hidden">
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
  </div>
</template>

<style>
:root {
  --color-link-label: var(--color-text);
  --color-link: #888;
  --color-node-external: #c0ad79;
  --color-node-inline: #8bc4a0;
  --color-node-label: var(--color-text);
  --color-node-stroke: var(--color-text);
  --graph-h: calc(100vh - 78px - 39px);
  --graph-w: 100%;
}

html.dark {
  --color-text: #fff;
  --color-node-external: #857a40;
  --color-node-inline: #468b60;
}

.graph {
  min-height: var(--graph-h) !important;
  max-height: var(--graph-h) !important;
  height: var(--graph-h) !important;
  min-width: var(--graph-w) !important;
  max-width: var(--graph-w) !important;
  width: var(--graph-w) !important;
}
.graph .node {
  stroke-width: 2px;
  stroke-opacity: 0.5;
}

.node:hover:not(.focused) {
  filter: none !important;
}
</style>
