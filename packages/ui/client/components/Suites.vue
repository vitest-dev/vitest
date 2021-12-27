<script setup lang="ts">
import { current } from '~/state'

const name = computed(() => current.value?.name.split(/\//g).pop())
</script>

<template>
  <div v-if="current" overflow-auto w-72 bg-panel border="r base">
    <div
      p="x4 y2"
      flex="~ gap-4"
      items-center
      bg-active
      border="b base"
    >
      <span font-light text-sm flex-1>
        {{ name }}
      </span>
      <button i-carbon-play />
    </div>

    <TestSuite
      v-for="suite in current.tasks"
      :key="suite.id"
      :task="suite"
    />
  </div>
</template>
