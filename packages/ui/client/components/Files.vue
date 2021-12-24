<script setup lang="ts">
import { activeFileId, connectionStatus, fileMetadata } from '~/context'

const filesRef = inject(fileMetadata)
const status = inject(connectionStatus)
const activeFileIdRef = inject(activeFileId)

const files = computed(() => (filesRef?.value ?? []).map(({
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
    duration: Math.round(result!.end! - result!.start),
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
      v-for="file in files"
      v-bind="file"
      :key="file.id"
    />
  </div>
</template>
