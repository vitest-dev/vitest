<template>
  <div h="full" flex="~ col">
    <div
      p="3"
      h-10
      flex="~ gap-2"
      items-center
      bg-header
      border="b base"
    >
      <div class="i-carbon-content-delivery-network" />
      <span
        pl-1
        font-bold
        text-sm
        flex-auto
        ws-nowrap
        overflow-hidden
        truncate
      >Browser UI</span>
    </div>
    <div flex-auto py-1>
      <div id="tester-ui" class="flex h-full justify-center items-center font-light op70">
        Select a test to run
      </div>
    </div>
  </div>
</template>
