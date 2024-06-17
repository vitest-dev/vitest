<template>
  <div h="full" flex="~ col">
    <div p="3" h-10 flex="~ gap-2" items-center bg-header border="b base">
      <div class="i-carbon-dashboard" />
      <span pl-1 font-bold text-sm flex-auto ws-nowrap overflow-hidden truncate>Dashboard</span>
    </div>
    <div class="scrolls" flex-auto py-1>
      <TestsFilesContainer />
    </div>
  </div>
</template>
