<script setup lang="ts">
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
  <div w-350 max-w-screen h-full flex flex-col>
    <div p-4 relative border="base b">
      <p>Screenshot error</p>
      <p op50 font-mono text-sm>
        {{ file }}
      </p>
      <p op50 font-mono text-sm>
        {{ name }}
      </p>
      <IconButton
        icon="i-carbon:close"
        title="Close"
        absolute
        top-5px
        right-5px
        text-2xl
        @click="emit('close')"
      />
    </div>

    <div class="scrolls" grid="~ cols-1 rows-[min-content]" p-4>
      <img
        v-if="url"
        :src="url"
        :alt="`Screenshot error for '${name}' test in file '${file}'`"
        border="base t r b l dotted red-500"
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
