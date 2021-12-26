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

    flex
    flex-row
    items-center
    px-4
    h-12
    border-rounded
    cursor-pointer
    hover:bg-gray-200
    dark:hover:bg-dark-300

    @click="onClick"
  >
    <span
      v-if="state === 'pass'"
      text-green-500
      i-carbon:checkmark-outline
      mr-4
      block
      text-xl
    />
    <span
      v-else-if="state === 'fail'"
      text-red-500
      i-carbon:misuse-outline
      mr-4
      block
      text-xl
    />
    <div flex flex-col>
      <span text-sm>{{ name }}</span>
      <span
        text-xs
        text-gray-500
        dark:text-light-500
        text-opacity-50
        dark:text-opacity-50
      >
        Took {{ duration }}ms
      </span>
    </div>
  </div>
</template>
