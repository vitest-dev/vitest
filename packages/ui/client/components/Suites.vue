<script setup lang="ts">
const { status, data, send } = useWebSocket('ws://localhost:51204/__vitest_api')

const suites = computed(() => JSON.parse(data.value || '[]').filter((x: any) => x))
</script>

<template>
  <div overflow-auto flex-1>
    <div
      h-8
      px-4
      flex
      flex-row
      items-center
      bg-dark-300
    >
      <span font-light text-sm flex-1>Test Suites</span>
      <button i-carbon-play />
    </div>
    {{ status }}

    <test-suite
      v-for="suite in suites"
      v-bind="suite"
      :key="suite.id"
    />
  </div>
</template>
