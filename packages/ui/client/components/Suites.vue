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
      bg-gray-200
      dark:bg-dark-300
      gap-4
    >
      <span font-light text-sm flex-1>
        Test Suites
      </span>
      <span v-if="status === 'CONNECTING'" i-carbon-wifi text-orange-300 />
      <span v-else-if="status === 'CLOSED'" i-carbon-wifi-off text-red-300 />
      <button i-carbon-play />
    </div>

    <test-suite
      v-for="suite in suites"
      v-bind="suite"
      :key="suite.id"
    />
  </div>
</template>
