<template>
  <div h="full" flex="~ col">
    <div
      p="2"
      h-10
      flex="~ gap-2"
      items-center
      bg-header
      border="b base"
    >
      <div class="i-carbon-dashboard" />
      <span
        font-light
        text-sm
        flex-auto
        ws-nowrap
        overflow-hidden
        truncate
      >Summary</span>
    </div>
    <div class="scrolls" flex-auto py-1>
      <TestEntry />
      <TestFilesEntry />
    </div>
  </div>
</template>
