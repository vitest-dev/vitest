<script setup lang="ts">
import { registerResizeListener } from '~/composables/client/resizing'

const viewport = ref('custom')
const resize = ref(false)

function changeViewport(name: string) {
  if (viewport.value === name) {
    viewport.value = 'custom'
  } else {
    viewport.value = name
  }
}
function onResize(resizing: boolean) {
  resize.value = resizing
}
onMounted(() => {
  registerResizeListener(onResize)
})
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
    <div class="grid scrolls place-items-center" style="height: calc(100vh - 84px)">
      <div
        id="tester-ui"
        class="flex font-light op70"
        :class="resize ? 'resizing': undefined"
        :data-viewport="viewport"
      >
        Select a test to run
      </div>
    </div>
  </div>
</template>

<style>
#tester-ui.resizing iframe {
  pointer-events: none;
}
[data-viewport="custom"] {
  padding: 11px;
}
[data-viewport="custom"],
[data-viewport="custom"] iframe {
  width: 100%;
  height: 100%;
}

[data-viewport="small-mobile"] {
  margin: 11px;
}
[data-viewport="small-mobile"],
[data-viewport="small-mobile"] iframe {
  width: 320px;
  height: 568px;
}

[data-viewport="large-mobile"] {
  margin: 11px;
}
[data-viewport="large-mobile"],
[data-viewport="large-mobile"] iframe {
  width: 414px;
  height: 896px;
}

[data-viewport="tablet-mobile"] {
  margin: 11px;
}
[data-viewport="tablet"],
[data-viewport="tablet"] iframe {
  width: 834px;
  height: 1112px;
}
</style>
