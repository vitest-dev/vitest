<script setup lang="ts">
import type { ViewportSize } from '~/composables/browser'
import { viewport } from '~/composables/browser'
import { browserState } from '~/composables/client'
import {
  detailsPanelVisible,
  detailsPosition,
  panels,
  showNavigationPanel,
  updateBrowserPanel,
} from '~/composables/navigation'
import IconButton from './IconButton.vue'

const sizes: Record<ViewportSize, [width: number, height: number]> = {
  'small-mobile': [320, 568],
  'large-mobile': [414, 896],
  'tablet': [834, 1112],
}

function isViewport(name: ViewportSize) {
  const preset = sizes[name]
  return viewport.value[0] === preset[0] && viewport.value[1] === preset[1]
}

async function changeViewport(name: ViewportSize) {
  viewport.value = sizes[name]
  if (browserState?.provider === 'webdriverio') {
    updateBrowserPanel()
  }
}
</script>

<template>
  <div id="browser-frame" h="full" flex="~ col">
    <div p="3" h-10 flex="~ gap-2" items-center bg-header border="b base">
      <IconButton
        v-show="panels.navigation <= 15"
        v-tooltip.bottom="'Show Navigation Panel'"
        title="Show Navigation Panel"
        rotate-180
        icon="i-carbon:side-panel-close"
        @click="showNavigationPanel()"
      />
      <div class="i-carbon-content-delivery-network" />
      <span pl-1 font-bold text-sm flex-auto ws-nowrap overflow-hidden truncate>Browser UI</span>
      <IconButton
        v-show="detailsPosition === 'right' && !detailsPanelVisible"
        v-tooltip.bottom="'Show Details Panel'"
        title="Show Details Panel"
        icon="i-carbon:side-panel-close"
        @click="detailsPanelVisible = true"
      />
    </div>
    <div p="l3 y2 r2" flex="~ gap-2" items-center bg-header border="b-2 base">
      <!-- TODO: these are only for preview (thank you Storybook!), we need to support more different and custom sizes (as a dropdown) -->
      <IconButton
        v-tooltip.bottom="'Small mobile'"
        title="Small mobile"
        icon="i-carbon:mobile"
        :active="isViewport('small-mobile')"
        @click="changeViewport('small-mobile')"
      />
      <IconButton
        v-tooltip.bottom="'Large mobile'"
        title="Large mobile"
        icon="i-carbon:mobile-add"
        :active="isViewport('large-mobile')"
        @click="changeViewport('large-mobile')"
      />
      <IconButton
        v-tooltip.bottom="'Tablet'"
        title="Tablet"
        icon="i-carbon:tablet"
        :active="isViewport('tablet')"
        @click="changeViewport('tablet')"
      />
      <span class="pointer-events-none" text-sm>
        {{ viewport[0] }}x{{ viewport[1] }}px
      </span>
    </div>
    <div id="tester-ui">
      Select a test to run
    </div>
  </div>
</template>

<style scoped>
#tester-ui {
  height: 100%;
  container-type: size;

  margin-top: 0.5rem;
}

#tester-ui:not([data-ready]) {
  display: flex;
  align-items: center;
  justify-content: center;

  opacity: 0.7;

  font-weight: 300;
}
</style>
