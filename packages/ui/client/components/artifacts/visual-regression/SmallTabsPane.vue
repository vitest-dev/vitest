<script setup lang="ts">
import type { SmallTabsConfig } from '~/composables/small-tabs'
import { computed, inject, onMounted, onUnmounted, useId } from 'vue'
import { idFor, SMALL_TABS_CONTEXT } from '~/composables/small-tabs'

interface TabPaneProps extends Omit<SmallTabsConfig, 'id'> {}

const props = defineProps<TabPaneProps>()

const context = inject(SMALL_TABS_CONTEXT)

if (!context) {
  throw new Error('TabPane must be used within Tabs')
}

const id = useId()

const isActive = computed(() => context.activeTab.value === id)

onMounted(() => {
  context.registerTab({ ...props, id })
})

onUnmounted(() => {
  context.unregisterTab({ ...props, id })
})
</script>

<template>
  <div
    :id="idFor.tabpanel(id, context.id)"
    role="tabpanel"
    :aria-labelledby="idFor.tab(id, context.id)"
    :hidden="!isActive"
    class="max-w-full"
  >
    <slot />
  </div>
</template>
