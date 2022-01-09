<script setup lang="ts">
import { injectCurrentModule } from '../composables/navigation'
import { client } from '~/composables/client'
import type { Params } from '~/composables/params'
import { viewMode } from '~/composables/params'
import type { ModuleGraph } from '~/composables/module-graph'
import { getModuleGraph } from '~/composables/module-graph'
import type { ModuleGraphData } from '#types'

const currentModule = injectCurrentModule()

function open() {
  const filePath = currentModule.value?.filepath
  if (filePath)
    fetch(`/__open-in-editor?file=${encodeURIComponent(filePath)}`)
}

const data = ref<ModuleGraphData>({ externalized: [], graph: {}, inlined: [] })
const graph = ref<ModuleGraph>({ nodes: [], links: [] })

debouncedWatch(
  currentModule,
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
  <div flex flex-col h-full max-h-full>
    <template v-if="currentModule">
      <div>
        <div p="2" h-10 flex="~ gap-2" items-center bg-header border="b base">
          <StatusIcon :task="currentModule" />
          <div flex-1 font-light op-50 ws-nowrap truncate text-sm>
            {{ currentModule?.filepath }}
          </div>
          <div class="flex text-lg">
            <IconButton icon="i-carbon-launch" :disabled="!currentModule?.filepath" :onclick="open" />
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
      <div flex flex-col flex-1 overflow="hidden">
        <ViewModuleGraph v-show="viewMode === 'graph'" :graph="graph" class="file-details-graph" />
        <ViewEditor v-if="viewMode === 'editor'" :file="currentModule" />
        <ViewReport v-else-if="!viewMode" :file="currentModule" />
      </div>
    </template>
    <ReportSummary v-else />
  </div>
</template>
