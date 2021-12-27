<script setup lang="ts">
import { client, current } from '~/composables/state'

const code = ref('')

watch(current, async() => {
  if (!current.value || !current.value.filepath)
    return
  code.value = await client.rpc.getSourceCode(current.value.filepath)
})

function open() {
  if (current.value?.filepath)
    fetch(`/__open-in-editor?file=${encodeURIComponent(current.value.filepath)}`)
}
</script>

<template>
  <div v-if="current" h-full w-full overflow="hidden">
    <div
      p="2"
      h-10
      text-sm
      flex="~ gap-2"
      items-center
      bg-header
      border="b base"
    >
      <div flex-1 font-light op-50 ws-nowrap tuncate>
        {{ current?.filepath }}
      </div>
      <div class="flex text-lg">
        <IconButton
          icon="i-carbon-launch"
          :disabled="!current?.filepath"
          :onclick="open"
        />
      </div>
    </div>
    <div overflow="auto">
      <pre v-if="current && code" op-50 p-2 text-sm v-text="code" />
    </div>
  </div>
</template>
