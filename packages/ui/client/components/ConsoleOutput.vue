
<script setup lang="ts">
import type { File } from '#types'

const props = withDefaults(defineProps<{
  modelValue?: boolean
  file?: File
}>(), {
  modelValue: false,
})

defineEmits<{
  (e: 'update:modelValue', modelValue: boolean): void }
>()

const consoleOutput = computed(() => props.file?.tasks?.map(i => i?.logs || []).flat() || [])

console.log(props.file, consoleOutput)
</script>

<template>
  <div w-full h-full overflow="hidden">
    <div
      flex justify-between cursor-pointer bg-header h-auto all:transition-400 p="x4 y2"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <p> Console output ({{ consoleOutput?.length || 0 }}) </p>
      <IconButton icon="i-carbon-caret-down" :class="modelValue ? 'rotate-180' : 'rotate-0'" :disabled="!logs?.length" />
    </div>
    <template v-if="modelValue && consoleOutput?.length">
      <div p="x4 y2" h-full class="scrolls">
        <div v-for="log of consoleOutput" :key="log" flex items-center my-2>
          <code :class="log.type === 'stderr' ? 'text-red-500': ''" ml="2">
            {{ log.content }}
          </code>
        </div>
      </div>
    </template>
  </div>
</template>
