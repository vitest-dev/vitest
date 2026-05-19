<script setup lang="ts">
import type { RunnerTestFile } from 'vitest'
import type { ModuleGraph } from '~/composables/module-graph'
import { ref, watch } from 'vue'
import { browserState, client } from '~/composables/client'
import { getModuleGraph } from '~/composables/module-graph'
import ViewModuleGraph from './views/ViewModuleGraph.vue'

const props = defineProps<{
  file: RunnerTestFile
}>()

const graph = ref<ModuleGraph>({ nodes: [], links: [] })
const loading = ref(false)
const hideNodeModules = ref(true)
const nodeModuleRegex = /[/\\]node_modules[/\\]/

watch(
  [
    () => props.file.filepath,
    () => props.file.file.projectName || '',
    hideNodeModules,
  ],
  async ([filepath, projectName, hide]) => {
    if (!filepath) {
      graph.value = { nodes: [], links: [] }
      return
    }

    const request = { filepath, projectName, hide }
    loading.value = true
    try {
      let moduleGraph = await client.rpc.getModuleGraph(
        projectName,
        filepath,
        !!browserState,
      )

      if (hide) {
        moduleGraph = {
          ...moduleGraph,
          inlined: moduleGraph.inlined.filter(n => !nodeModuleRegex.test(n)),
          externalized: moduleGraph.externalized.filter(n => !nodeModuleRegex.test(n)),
        }
      }

      if (
        props.file.filepath !== request.filepath
        || (props.file.file.projectName || '') !== request.projectName
        || hideNodeModules.value !== request.hide
      ) {
        return
      }

      graph.value = getModuleGraph(moduleGraph, filepath)
    }
    finally {
      if (
        props.file.filepath === request.filepath
        && (props.file.file.projectName || '') === request.projectName
        && hideNodeModules.value === request.hide
      ) {
        loading.value = false
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <div flex-1 overflow-hidden>
    <div v-if="loading" h-full flex items-center justify-center op-70>
      Loading module graph...
    </div>
    <ViewModuleGraph
      v-else
      v-model="hideNodeModules"
      :graph="graph"
      data-testid="graph"
      :project-name="file.file.projectName || ''"
    />
  </div>
</template>
