<script setup lang="ts">
defineProps<{
  src: string
}>()
</script>

<template>
  <div h="full" flex="~ col">
    <div p="3" h-10 flex="~ gap-2" items-center bg-header border="b base">
      <div class="i-carbon:folder-details-reference" />
      <span pl-1 font-bold text-sm flex-auto ws-nowrap overflow-hidden truncate>Coverage</span>
    </div>
    <div flex-auto py-1 bg-white>
      <iframe id="vitest-ui-coverage" :src="src" />
    </div>
  </div>
</template>

<style>
#vitest-ui-coverage {
  width: 100%;
  height: calc(100vh - 42px);
  border: none;
}
</style>
