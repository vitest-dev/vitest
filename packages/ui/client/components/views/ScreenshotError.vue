<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import IconButton from '../IconButton.vue'

defineProps<{
  file: string
  name: string
  url?: string
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

onKeyStroke('Escape', () => {
  emit('close')
})
</script>

<template>
  <div class="w-350 max-w-screen h-full flex flex-col">
    <div class="p-4 relative border-base border-b">
      <p>Screenshot error</p>
      <p class="op50 font-mono text-sm">
        {{ file }}
      </p>
      <p class="op50 font-mono text-sm">
        {{ name }}
      </p>
      <IconButton
        icon="i-carbon:close"
        title="Close"
        class="absolute top-5px right-5px text-2xl"
        @click="emit('close')"
      />
    </div>

    <div class="scrolls grid grid-cols-1 grid-rows-[min-content] p-4">
      <img
        v-if="url"
        :src="url"
        :alt="`Screenshot error for '${name}' test in file '${file}'`"
        class="border-base border-t border-r border-b border-dotted border-red-500 border-l"
      >
      <div v-else>
        Something was wrong, the image cannot be resolved.
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrolls {
  place-items: center;
}
</style>
