<script setup lang="ts">
import { Pane, Splitpanes } from 'splitpanes'
import { client, current } from '~/composables/client'
import type { Params } from '~/composables/params'
import { viewMode } from '~/composables/params'
import type { ModuleGraph } from '~/composables/module-graph'
import { getModuleGraph } from '~/composables/module-graph'
import type { ModuleGraphData } from '#types'

const sizes = reactive([95, 5])

function onResize(event: { size: number }[]) {
  event.forEach((e, i) => {
    sizes[i] = e.size
  })
}

onMounted(() => {
  const bottomPanelPercent = 42 / window.innerHeight * 100

  sizes[0] = 100 - bottomPanelPercent
  sizes[1] = bottomPanelPercent
})

function open() {
  const filePath = current.value?.filepath
  if (filePath)
    fetch(`/__open-in-editor?file=${encodeURIComponent(filePath)}`)
}

const showOutput = ref(false)
const data = ref<ModuleGraphData>({ externalized: [], graph: {}, inlined: [] })
const graph = ref<ModuleGraph>({ nodes: [], links: [] })

debouncedWatch(
  current,
  async(c, o) => {
    if (c && c.filepath !== o?.filepath) {
      data.value = await client.rpc.getModuleGraph(c.filepath)
      graph.value = getModuleGraph(data.value, c.filepath)
    }
  },
  { debounce: 100 },
)

const changeViewMode = (view: Params['view']) => {
  viewMode.value = view
}
</script>

<template>
  <div v-if="current" flex flex-col h-full max-h-full overflow-hidden>
    <div>
      <div p="2" h-10 flex="~ gap-2" items-center bg-header border="b base">
        <StatusIcon :task="current" />
        <div flex-1 font-light op-50 ws-nowrap truncate text-sm>
          {{ current?.filepath }}
        </div>
        <div class="flex text-lg">
          <IconButton icon="i-carbon-launch" :disabled="!current?.filepath" :onclick="open" />
        </div>
      </div>
      <div flex="~" items-center bg-header border="b base" text-sm h-37px>
        <button tab-button :class="{ 'tab-button-active': viewMode == null }" @click="changeViewMode(null)">
          Report
        </button>
        <button tab-button :class="{ 'tab-button-active': viewMode === 'graph' }" @click="changeViewMode('graph')">
          Module Graph
        </button>
        <button tab-button :class="{ 'tab-button-active': viewMode === 'editor' }" @click="changeViewMode('editor')">
          Code
        </button>
      </div>
    </div>

    <Splitpanes :push-other-panes="false" horizontal overflow-hidden max-h-full @resize="paneSize = $event[0].size">
      <Pane :min-size="40" :size="showOutput ? 60 : 80">
        <ViewModuleGraph v-show="viewMode === 'graph'" :graph="graph" />
        <ViewEditor v-if="viewMode === 'editor'" :file="current" />
        <ViewReport v-else-if="!viewMode" :file="current" />
      </Pane>
      <Pane :min-size="20" :size="showOutput ? 40 : 20">
        <ConsoleOutput v-model="showOutput" :file="current" />
      </Pane>
    </Splitpanes>
  </div>
</template>
