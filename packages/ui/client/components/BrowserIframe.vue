<script setup lang="ts">
import { viewport, customViewport } from "~/composables/browser";
import type { ViewportSize } from "~/composables/browser";
import { setIframeViewport, getCurrentBrowserIframe } from "~/composables/api";

const sizes: Record<ViewportSize, [width: string, height: string] | null> = {
  "small-mobile": ["320px", "568px"],
  "large-mobile": ["414px", "896px"],
  tablet: ["834px", "1112px"],
  full: ["100%", "100%"],
  // should not be used manually, this is just
  // a fallback for the case when the viewport is not set correctly
  custom: null,
};

async function changeViewport(name: ViewportSize) {
  if (viewport.value === name) {
    viewport.value = customViewport.value ? "custom" : "full";
  } else {
    viewport.value = name;
  }

  const iframe = getCurrentBrowserIframe();
  if (!iframe) {
    console.warn("Iframe not found");
    return;
  }

  const [width, height] =
    sizes[viewport.value] || customViewport.value || sizes.full;

  await setIframeViewport(width, height);
}
</script>

<template>
  <div h="full" flex="~ col">
    <div p="3" h-10 flex="~ gap-2" items-center bg-header border="b base">
      <div class="i-carbon-content-delivery-network" />
      <span pl-1 font-bold text-sm flex-auto ws-nowrap overflow-hidden truncate
        >Browser UI</span
      >
    </div>
    <div p="l3 y2 r2" flex="~ gap-2" items-center bg-header border="b-2 base">
      <!-- TODO: these are only for preview (thank you Storybook!), we need to support more different and custom sizes (as a dropdown) -->
      <IconButton
        v-tooltip.bottom="'Flexible'"
        title="Flexible"
        icon="i-carbon:fit-to-screen"
        :active="viewport === 'full'"
        @click="changeViewport('full')"
      />
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
    <div flex-auto class="scrolls">
      <div
        id="tester-ui"
        class="flex h-full justify-center items-center font-light op70"
        style="overflow: auto; width: 100%; height: 100%"
      >
        Select a test to run
      </div>
    </div>
  </div>
</template>
