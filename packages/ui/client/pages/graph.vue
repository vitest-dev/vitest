<script setup lang="ts">
import { client, current } from '~/composables/client'
import { useModuleGraph, useModuleGraphConfig } from '~/composables/module-graph'

const data = asyncComputed(async() => {
  return current.value?.filepath
    ? await client.rpc.getModuleGraph(current.value.filepath)
    : { externalized: [], graph: {}, inlined: [] }
})

const graph = useModuleGraph(data)

const config = useModuleGraphConfig(graph)

</script>

<template>
  <div grid="~ cols-[15rem_auto]" h-screen w-screen overflow="hidden">
    <Navigation />
    <ModuleGraph v-if="graph !== undefined && config !== undefined" :graph="graph" :config="config" />
  </div>
  <ConnectionOverlay />
</template>
