<script setup lang="ts">
const { status, data, send } = useWebSocket('ws://localhost:3000/__vitest_api')
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
    {{ data }}
  </div>
</template>
