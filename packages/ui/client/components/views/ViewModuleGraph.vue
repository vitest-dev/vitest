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
import {
  defineGraphConfig,
  GraphController,
  Markers,
  PositionInitializers,
} from 'd3-graph-controller'
import { isReport } from '~/composables/client'

const props = defineProps<{
  graph: ModuleGraph
  projectName: string
}>()

const hideNodeModules = defineModel<boolean>({ required: true })

const { graph } = toRefs(props)

const el = ref<HTMLDivElement>()

const modalShow = ref(false)
const selectedModule = ref<string | null>()
const controller = ref<ModuleGraphController | undefined>()

watchEffect(
  () => {
    if (modalShow.value === false) {
      setTimeout(() => (selectedModule.value = undefined), 300)
    }
  },
  { flush: 'post' },
)

onMounted(() => {
  resetGraphController()
})

onUnmounted(() => {
  controller.value?.shutdown()
})

watch(graph, () => resetGraphController())

function setFilter(name: ModuleType, value: boolean) {
  controller.value?.filterNodesByType(value, name)
}

function setSelectedModule(id: string) {
  selectedModule.value = id
  modalShow.value = true
}

function resetGraphController(reset = false) {
  controller.value?.shutdown()

  // Force reload the module graph only when node_modules are shown.
  // The module graph doesn't contain node_modules entries.
  if (reset && !hideNodeModules.value) {
    hideNodeModules.value = true
    return
  }

  if (!graph.value || !el.value) {
    return
  }

  controller.value = new GraphController(
    el.value!,
    graph.value,
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
            return 0.25
          },
        },
        forces: {
          collision: {
            radiusMultiplier: 10,
          },
          link: {
            length: 240,
          },
        },
      },
      marker: Markers.Arrow(2),
      modifiers: {
        node: bindOnClick,
      },
      positionInitializer:
        graph.value.nodes.length > 1
          ? PositionInitializers.Randomized
          : PositionInitializers.Centered,
      zoom: {
        min: 0.5,
        max: 2,
      },
    }),
  )
}

const isValidClick = (event: PointerEvent) => event.button === 0

function bindOnClick(
  selection: Selection<SVGCircleElement, ModuleNode, SVGGElement, undefined>,
) {
  if (isReport) {
    return
  }
  // Only trigger on left-click and primary touch
  let px = 0
  let py = 0
  let pt = 0

  selection
    .on('pointerdown', (event: PointerEvent, node) => {
      if (node.type === 'external') {
        return
      }
      if (!node.x || !node.y || !isValidClick(event)) {
        return
      }
      px = node.x
      py = node.y
      pt = Date.now()
    })
    .on('pointerup', (event: PointerEvent, node: ModuleNode) => {
      if (node.type === 'external') {
        return
      }
      if (!node.x || !node.y || !isValidClick(event)) {
        return
      }
      if (Date.now() - pt > 500) {
        return
      }
      const dx = node.x - px
      const dy = node.y - py
      if (dx ** 2 + dy ** 2 < 100) {
        setSelectedModule(node.id)
      }
    })
}
</script>

<template>
  <div h-full min-h-75 flex-1 overflow="hidden">
    <div>
      <div flex items-center gap-4 px-3 py-2>
        <div
          flex="~ gap-1"
          items-center
          select-none
        >
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
        <div>
          <IconButton
            v-tooltip.bottom="'Reset'"
            icon="i-carbon-reset"
            @click="resetGraphController(true)"
          />
        </div>
      </div>
    </div>
    <div ref="el" />
    <Modal v-model="modalShow" direction="right">
      <template v-if="selectedModule">
        <Suspense>
          <ModuleTransformResultView
            :id="selectedModule"
            :project-name="projectName"
            @close="modalShow = false"
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
  --color-node-external: #c0ad79;
  --color-node-inline: #8bc4a0;
  --color-node-root: #6e9aa5;
  --color-node-label: var(--color-text);
  --color-node-stroke: var(--color-text);
}

html.dark {
  --color-text: #fff;
  --color-link: #333;
  --color-node-external: #857a40;
  --color-node-inline: #468b60;
  --color-node-root: #467d8b;
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
