<script setup lang="ts">
defineProps<{
  id: string
  name: string
  type: string
  mode: string
  result: {
    start: number
    state: string
    end: number
  }
}>()
</script>

<template>
  <div
    v-if="name"
    flex
    flex-row
    items-center
    px-4
    h-12
    border-rounded
  >
    <span text-green-500 i-carbon:checkmark-outline mr-4 block text-xl />
    <div flex flex-col>
      <span text-sm>{{ name }}</span>
      <span
        text-xs
        text-gray-500
        dark:text-light-500
        text-opacity-50
        dark:text-opacity-50
      >
        Took {{ Math.round(result.end - result.start) }}ms
      </span>
    </div>
  </div>
</template>
