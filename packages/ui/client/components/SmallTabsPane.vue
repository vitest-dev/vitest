<script setup lang="ts">
import type { SmallTabsConfig } from '~/composables/small-tabs'
import { computed, inject, onMounted, onUnmounted } from 'vue'
import { idFor, SMALL_TABS_CONTEXT } from '~/composables/small-tabs'

interface TabPaneProps extends SmallTabsConfig {}

const props = defineProps<TabPaneProps>()

const context = inject(SMALL_TABS_CONTEXT)

if (!context) {
  throw new Error('TabPane must be used within Tabs')
}

const isActive = computed(() => context.activeTab.value === props.name)

onMounted(() => {
  context.registerTab(props)
})

onUnmounted(() => {
  context.unregisterTab(props)
})
</script>

<template>
  <div
    :id="idFor.tabpanel(props.name, context.id)"
    role="tabpanel"
    :aria-labelledby="idFor.tab(props.name, context.id)"
    :hidden="!isActive" class="max-w-full"
  >
    <slot />
  </div>
</template>
