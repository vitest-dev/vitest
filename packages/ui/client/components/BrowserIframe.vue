<script setup lang="ts">
import type { ViewportSize } from '~/composables/browser'
import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'
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

const { width: windowWidth, height: windowHeight } = useWindowSize()

async function changeViewport(name: ViewportSize) {
  viewport.value = sizes[name]
  if (browserState?.provider === 'webdriverio') {
    updateBrowserPanel()
  }
}

const PADDING_SIDES = 20
const PADDING_TOP = 100

const containerSize = computed(() => {
  if (browserState?.provider === 'webdriverio') {
    const [width, height] = viewport.value
    return { width, height }
  }

  const parentContainerWidth = windowWidth.value * (panels.details.size / 100)
  const parentOffsetWidth = parentContainerWidth * (panels.details.browser / 100)
  const containerWidth = parentOffsetWidth - PADDING_SIDES
  const containerHeight = windowHeight.value - PADDING_TOP
  return {
    width: containerWidth,
    height: containerHeight,
  }
})

const scale = computed(() => {
  if (browserState?.provider === 'webdriverio') {
    return 1
  }

  const [iframeWidth, iframeHeight] = viewport.value
  const { width: containerWidth, height: containerHeight } = containerSize.value
  const widthScale = containerWidth > iframeWidth ? 1 : containerWidth / iframeWidth
  const heightScale = containerHeight > iframeHeight ? 1 : containerHeight / iframeHeight
  return Math.min(1, widthScale, heightScale)
})

const marginLeft = computed(() => {
  const containerWidth = containerSize.value.width
  const iframeWidth = viewport.value[0]
  const offset = Math.trunc((containerWidth + PADDING_SIDES - iframeWidth) / 2)
  return `${offset}px`
})
</script>

<template>
  <div h="full" flex="~ col">
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
        <span v-if="scale < 1">({{ (scale * 100).toFixed(0) }}%)</span>
      </span>
    </div>
    <div id="tester-container" relative>
      <div
        id="tester-ui"
        class="flex h-full justify-center items-center font-light op70"
        :data-scale="scale"
        :style="{
          '--viewport-width': `${viewport[0]}px`,
          '--viewport-height': `${viewport[1]}px`,
          '--tester-transform': `scale(${scale})`,
          '--tester-margin-left': marginLeft,
        }"
      >
        Select a test to run
      </div>
    </div>
  </div>
</template>

<style scoped>
#tester-container:not([data-ready]) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

[data-ready] #tester-ui {
  width: var(--viewport-width);
  height: var(--viewport-height);
  transform: var(--tester-transform);
  margin-left: var(--tester-margin-left);
}
</style>
