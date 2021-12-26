<script setup lang="ts">
import { activeFileIdRef, files, status } from '../state'

const filtered = computed(() => (files?.value ?? []).map(({
  id,
  name,
  type,
  mode,
  result,
}) => {
  return {
    id,
    name,
    type,
    mode,
    state: result!.state,
    duration: (result && result.end) ? Math.round(result.end - result.start) : 0,
    onClick: () => {
      if (activeFileIdRef)
        activeFileIdRef.value = id
    },
  }
}))

</script>

<template>
  <div overflow-auto flex-1>
    <div
      h-8
      px-4
      flex
      flex-row
      items-center
      bg-gray-200
      dark:bg-dark-300
      gap-4
    >
      <span font-light text-sm flex-1>
        Test Files
      </span>
      <span v-if="status === 'CONNECTING'" i-carbon-wifi text-orange-300 />
      <span v-else-if="status === 'CLOSED'" i-carbon-wifi-off text-red-300 />
      <button i-carbon-play />
    </div>

    <test-file
      v-for="file in filtered"
      v-bind="file"
      :key="file.id"
    />
  </div>
</template>
