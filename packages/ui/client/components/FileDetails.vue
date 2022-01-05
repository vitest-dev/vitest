<script setup lang="ts">
import { injectCurrentModule } from '../composables/navigation'
import { client } from '~/composables/client'
import type { Params } from '~/composables/params'
import { viewMode } from '~/composables/params'
import { useModuleGraph } from '~/composables/module-graph'

const currentModule = injectCurrentModule()

function open() {
  const filePath = currentModule.value?.filepath
  if (filePath)
    fetch(`/__open-in-editor?file=${encodeURIComponent(filePath)}`)
}

const data = asyncComputed(async() => {
  return currentModule.value
    ? await client.rpc.getModuleGraph(currentModule.value.filepath)
    : { externalized: [], graph: {}, inlined: [] }
})

const graph = useModuleGraph(data)
const changeViewMode = (view: Params['view']) => {
  viewMode.value = view
}
</script>

<template>
  <div v-if="currentModule" h-full>
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
    <ViewModuleGraph v-show="viewMode === 'graph'" :graph="graph" />
    <ViewEditor v-if="viewMode === 'editor'" :file="currentModule" />
    <ViewReport v-else-if="!viewMode" :file="currentModule" />
  </div>
</template>
