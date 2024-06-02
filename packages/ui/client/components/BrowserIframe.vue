<script setup lang="ts">
import { useResizing } from '~/composables/browser'

type ViewportSize = 'small-mobile' | 'large-mobile' | 'tablet' | 'custom'

const sizes: Record<ViewportSize, [width: string, height: string]> = {
  'small-mobile': ['320px', '568px'],
  'large-mobile': ['414px', '896px'],
  tablet: ['834px', '1112px'],
  custom: ['100%', '100%'],
}

const testerRef = ref<HTMLDivElement | undefined>()
const viewport = ref<ViewportSize>('custom')

const { recalculateDetailPanels } = useResizing(testerRef)

async function changeViewport(name: ViewportSize) {
  if (viewport.value === name) {
    viewport.value = 'custom'
  } else {
    viewport.value = name
  }

  const iframe = document.querySelector<HTMLIFrameElement>('#tester-ui iframe[data-vitest]')
  if (!iframe) {
    console.warn('Iframe not found')
    return
  }

  const [width, height] = sizes[viewport.value]

  iframe.style.width = width
  iframe.style.height = height

  await new Promise(r => requestAnimationFrame(r))

  recalculateDetailPanels()
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
    <div flex-auto class="scrolls">
      <div id="tester-ui" ref="testerRef" class="flex h-full justify-center items-center font-light op70" style="overflow: auto; width: 100%; height: 100%">
        Select a test to run
      </div>
    </div>
  </div>
</template>
