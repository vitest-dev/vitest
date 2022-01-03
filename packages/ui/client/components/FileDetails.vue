<script setup lang="ts">
import { client, current } from '~/composables/client'
import type { Params } from '~/composables/params'
import { viewMode } from '~/composables/params'
import { useModuleGraph } from '~/composables/module-graph'

function open() {
  if (current.value?.filepath)
    fetch(`/__open-in-editor?file=${encodeURIComponent(current.value.filepath)}`)
}

const data = asyncComputed(async() => {
  const filepath = current.value?.filepath
  return filepath
    ? await client.rpc.getModuleGraph(filepath)
    : { externalized: [], graph: {}, inlined: [] }
})

const graph = useModuleGraph(data)
const changeViewMode = (view: Params['view']) => {
  viewMode.value = view
}
</script>

<template>
  <div v-if="current" h-full>
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
    <ViewModuleGraph v-show="viewMode === 'graph'" :graph="graph" />
    <ViewEditor v-if="viewMode === 'editor'" :file="current" />
    <ViewReport v-else :file="current" />
  </div>
</template>
