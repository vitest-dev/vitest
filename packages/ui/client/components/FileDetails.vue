<script setup lang="ts">
import { client, current, currentLogs } from '~/composables/client'
import type { Params } from '~/composables/params'
import { viewMode } from '~/composables/params'
import type { ModuleGraph } from '~/composables/module-graph'
import { getModuleGraph } from '~/composables/module-graph'
import type { ModuleGraphData } from '#types'

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
  { debounce: 100, immediate: true },
)

const open = () => {
  const filePath = current.value?.filepath
  if (filePath)
    fetch(`/__open-in-editor?file=${encodeURIComponent(filePath)}`)
}

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
          <IconButton
            v-tooltip.bottom="'Open in editor'"
            icon="i-carbon-launch"
            :disabled="!current?.filepath"
            @click="open"
          />
        </div>
      </div>
      <div flex="~" items-center bg-header border="b-2 base" text-sm h-38px>
        <button
          tab-button
          :class="{ 'tab-button-active': viewMode == null }"
          @click="changeViewMode(null)"
        >
          Report
        </button>
        <button
          tab-button
          :class="{ 'tab-button-active': viewMode === 'graph' }"
          @click="changeViewMode('graph')"
        >
          Module Graph
        </button>
        <button
          tab-button
          :class="{ 'tab-button-active': viewMode === 'editor' }"
          @click="changeViewMode('editor')"
        >
          Code
        </button>
        <button
          tab-button
          :class="{ 'tab-button-active': viewMode === 'console', 'op20': viewMode !== 'console' && currentLogs?.length === 0 }"
          @click="changeViewMode('console')"
        >
          Console ({{ currentLogs?.length || 0 }})
        </button>
      </div>
    </div>

    <div flex flex-col flex-1 overflow="hidden">
      <ViewModuleGraph v-show="viewMode === 'graph'" :graph="graph" />
      <ViewEditor v-if="viewMode === 'editor'" :key="current.filepath" :file="current" />
      <ViewConsoleOutput v-else-if="viewMode === 'console'" :file="current" />
      <ViewReport v-else-if="!viewMode" :file="current" />
    </div>
  </div>
</template>
