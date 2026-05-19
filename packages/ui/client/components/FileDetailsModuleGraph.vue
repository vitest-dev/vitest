<script setup lang="ts">
import type { RunnerTestFile } from 'vitest'
import { useAsyncState } from '@vueuse/core'
import { computed, ref } from 'vue'
import { client } from '~/composables/client'
import { getModuleGraph } from '~/composables/module-graph'
import ViewModuleGraph from './views/ViewModuleGraph.vue'

const props = defineProps<{
  file: RunnerTestFile
  projectName: string
}>()

const hideNodeModules = ref(true)
const NODE_MODULES_RE = /[/\\]node_modules[/\\]/

const { state: graphData, isLoading } = useAsyncState(
  () => client.rpc.getModuleGraph(
    props.projectName,
    props.file.filepath,
  ),
  undefined,
)

const graph = computed(() => {
  if (!graphData.value) {
    return { nodes: [], links: [] }
  }
  let moduleGraph = graphData.value
  if (hideNodeModules.value) {
    moduleGraph = {
      ...moduleGraph,
      inlined: moduleGraph.inlined.filter(n => !NODE_MODULES_RE.test(n)),
      externalized: moduleGraph.externalized.filter(n => !NODE_MODULES_RE.test(n)),
    }
  }
  return getModuleGraph(moduleGraph, props.file.filepath)
})
</script>

<template>
  <div flex-1 overflow-hidden>
    <div v-if="isLoading" h-full flex items-center justify-center op-70>
      Loading module graph...
    </div>
    <ViewModuleGraph
      v-else
      v-model="hideNodeModules"
      data-testid="graph"
      :graph="graph"
      :project-name="props.projectName"
    />
  </div>
</template>
