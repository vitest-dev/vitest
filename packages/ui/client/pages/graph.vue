<script setup lang="ts">
import { client, current } from '~/composables/client'

const data = asyncComputed(async() => {
  return current.value?.filepath
    ? await client.rpc.getModuleGraph(current.value.filepath)
    : {}
})
</script>

<template>
  <div>
    <pre>{{ JSON.stringify(data, null, 2) }}</pre>
  </div>
</template>
