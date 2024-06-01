<script setup lang="ts">
const viewport = ref('custom')

function changeViewport(name: string) {
  if (viewport.value === name) {
    viewport.value = 'custom'
  } else {
    viewport.value = name
  }
}
</script>

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
    <div
      p="l3 y2 r2"
      flex="~ gap-2"
      items-center
      bg-header
      border="b-2 base"
    >
      <!-- TODO: these are only for preview (thank you Storybook!), we need to support more different and custom sizes (as a dropdown) -->
      <IconButton
        v-tooltip.bottom="'Small mobile'"
        title="Small mobile"
        icon="i-carbon:mobile"
        :active="viewport === 'small-mobile'"
        @click="changeViewport('small-mobile')"
      />
      <IconButton
        v-tooltip.bottom="'Large mobile'"
        title="Large mobile"
        icon="i-carbon:mobile-add"
        :active="viewport === 'large-mobile'"
        @click="changeViewport('large-mobile')"
      />
      <IconButton
        v-tooltip.bottom="'Tablet'"
        title="Tablet"
        icon="i-carbon:tablet"
        :active="viewport === 'tablet'"
        @click="changeViewport('tablet')"
      />
    </div>
    <div flex-auto overflow-auto>
      <div id="tester-ui" class="flex h-full justify-center items-center font-light op70" style="overflow: auto; width: 100%; height: 100%" :data-viewport="viewport">
        Select a test to run
      </div>
    </div>
  </div>
</template>

<style>
[data-viewport="custom"] iframe {
  width: 100%;
  height: 100%;
}

[data-viewport="small-mobile"] iframe {
  width: 320px;
  height: 568px;
}

[data-viewport="large-mobile"] iframe {
  width: 414px;
  height: 896px;
}

[data-viewport="tablet"] iframe {
  width: 834px;
  height: 1112px;
}
</style>
