<template>
  <div h-full overflow="hidden">
    <div border="r base">
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

<script setup lang="ts">
import { GraphController } from 'd3-graph-controller'
import type { File } from '#types'
import { client } from '~/composables/client'
import type { ModuleGraphController, ModuleType } from '~/composables/module-graph'
import { useModuleGraph, useModuleGraphConfig } from '~/composables/module-graph'

const props = defineProps<{
  file?: File
}>()

const data = asyncComputed(async() => {
  return props.file?.filepath
    ? await client.rpc.getModuleGraph(props.file.filepath)
    : { externalized: [], graph: {}, inlined: [] }
})

const el = ref<HTMLDivElement>()
const graph = useModuleGraph(data)
const config = useModuleGraphConfig(graph)
const controller = ref<ModuleGraphController | undefined>()

useResizeObserver(el, debounce(() => {
  controller.value?.resize()
}))

onMounted(() => {
  resetGraphController()
})

onMounted(() => {
  controller.value?.shutdown()
})

watch(graph, resetGraphController, { immediate: true })

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

<style scoped>
.type-checkbox {
  align-items: center;
  display: flex;
  gap: 0.25em;
}

.type-circle {
  display: inline;
  border-radius: 50%;
  width: 0.75rem;
  height: 0.75rem;
}
</style>

<style>
:root {
  --color-link-label: var(--color-text);
  --color-link: #888;
  --color-node-external: #c0ad79;
  --color-node-inline: #8bc4a0;
  --color-node-label: var(--color-text);
  --color-node-stroke: var(--color-text);
}

html.dark {
  --color-text: #fff;
  --color-node-external: #857a40;
  --color-node-inline: #468b60;
}

.graph .node {
  stroke-width: 2px;
  stroke-opacity: 0.5;
}

.node:hover:not(.focused) {
  filter: none !important;
}
</style>
