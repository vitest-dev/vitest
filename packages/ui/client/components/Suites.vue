<script setup lang="ts">
import { current } from '~/state'
</script>

<template>
  <div v-if="current" overflow-auto w-72>
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
        {{ current.name }}
      </span>
      <button i-carbon-play />
    </div>

    <test-suite
      v-for="suite in current.tasks"
      :key="suite.id"
      :task="suite"
    />
  </div>
</template>
