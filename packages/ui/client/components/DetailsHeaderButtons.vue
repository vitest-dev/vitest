<script setup lang="ts">
import IconButton from '~/components/IconButton.vue'
import {
  detailsPanelVisible,
  detailsPosition,
  hideDetailsPanel,
  showDetailsPanel,
  toggleDetailsPosition,
} from '~/composables/navigation'

function getDetailsPanelToggleRotation(action: 'show' | 'hide') {
  // `i-carbon:side-panel-close` is treated as "pointing right" by default.
  // We rotate it based on where the details panel is positioned.
  if (detailsPosition.value === 'right') {
    return action === 'hide' ? 'rotate-180' : ''
  }
  // detailsPosition === 'bottom'
  return action === 'hide' ? '-rotate-90' : 'rotate-90'
}
</script>

<template>
  <IconButton
    v-tooltip.bottom="`Switch panel position (${detailsPosition === 'bottom' ? 'right' : 'bottom'})`"
    :title="`Switch panel position (${detailsPosition === 'bottom' ? 'right' : 'bottom'})`"
    icon="i-carbon-split-screen"
    :class="{ 'rotate-90': detailsPosition === 'right' }"
    @click="toggleDetailsPosition"
  />
  <IconButton
    v-if="detailsPanelVisible"
    v-tooltip.bottom="detailsPosition === 'right' ? 'Hide Right Panel' : 'Hide Bottom Panel'"
    :title="detailsPosition === 'right' ? 'Hide Right Panel' : 'Hide Bottom Panel'"
    icon="i-carbon:side-panel-close"
    :class="getDetailsPanelToggleRotation('hide')"
    @click="hideDetailsPanel"
  />
  <IconButton
    v-show="!detailsPanelVisible"
    v-tooltip.bottom="detailsPosition === 'right' ? 'Show Right Panel' : 'Show Bottom Panel'"
    :title="detailsPosition === 'right' ? 'Show Right Panel' : 'Show Bottom Panel'"
    icon="i-carbon:side-panel-close"
    :class="getDetailsPanelToggleRotation('show')"
    @click="showDetailsPanel"
  />
</template>
