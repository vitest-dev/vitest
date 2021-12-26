<script setup lang="ts">
defineProps<{
  id: string
  name: string
  type: string
  mode: string
  state: string
  duration: number
  onClick?: () => void
}>()
</script>

<template>
  <div
    v-if="name"
    flex="~ row"
    items-center
    px-4
    h-12
    border-rounded
    cursor-pointer
    hover="bg-gray-200 dark:bg-dark-300"
    @click="onClick"
  >
    <span
      v-if="state === 'pass'"
      text="green-500 xl"
      i-carbon:checkmark-outline
      mr-4
      block
    />
    <span
      v-else-if="state === 'fail'"
      text="red-500 xl"
      i-carbon:misuse-outline
      mr-4
      block
    />
    <div flex flex-col>
      <span text-sm>{{ name }}</span>
      <span text="xs gray-500 dark:light-500" op50>{{ duration }}ms</span>
    </div>
  </div>
</template>
