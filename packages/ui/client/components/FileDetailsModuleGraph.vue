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

const { state: graphData, isLoading } = useAsyncState(
  () =>
    client.rpc.getModuleGraph(props.projectName, props.file.filepath, props.file.viteEnvironment),
  undefined,
)

const graph = computed(() =>
  getModuleGraph(graphData.value, props.file.filepath, hideNodeModules.value),
)
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <div v-if="isLoading" class="h-full flex items-center justify-center op-70">
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
