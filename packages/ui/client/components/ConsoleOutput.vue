
<script setup lang="ts">
import type { File } from '#types'

const props = withDefaults(defineProps<{
  modelValue?: boolean
  file?: File
}>(), {
  modelValue: false,
  file: undefined,
})

defineEmits<{
  (e: 'update:modelValue', modelValue: boolean): void }
>()

const consoleOutput = computed(() => props.file?.tasks?.map(i => i?.logs || []).flat() || [])
</script>

<template>
  <div w-full>
    <div
      flex justify-between cursor-pointer bg-header h-auto all:transition-400 p="x4 y2"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <p> Console output ({{ consoleOutput?.length || 0 }}) </p>
      <IconButton icon="i-carbon-caret-down" :class="!modelValue ? 'rotate-180' : 'rotate-0'" :disabled="!logs?.length" />
    </div>
    <template v-if="modelValue">
      <div p="x4 y6">
        <div v-for="log of consoleOutput" :key="log" my-2>
          {{ log.content }}
        </div>
      </div>
    </template>
  </div>
</template>
