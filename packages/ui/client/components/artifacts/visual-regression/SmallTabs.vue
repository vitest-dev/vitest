<script setup lang="ts">
import type { SmallTabsConfig } from '~/composables/small-tabs'
import { provide, ref, useId } from 'vue'
import { idFor, SMALL_TABS_CONTEXT } from '~/composables/small-tabs'

const activeTab = ref<string | null>(null)
const tabs = ref<SmallTabsConfig[]>([])

const id = useId()

provide(SMALL_TABS_CONTEXT, {
  id,
  activeTab,
  registerTab: (tab) => {
    if (!tabs.value.some(({ id }) => id === tab.id)) {
      tabs.value.push(tab)
    }

    if (tabs.value.length === 1) {
      activeTab.value = tab.id
    }
  },
  unregisterTab: (tab) => {
    const index = tabs.value.findIndex(({ id }) => id === tab.id)

    if (index > -1) {
      tabs.value.splice(index, 1)
    }

    if (activeTab.value === tab.id) {
      activeTab.value = tabs.value[0]?.id ?? null
    }
  },
})
</script>

<template>
  <div
    class="flex flex-col items-center gap-6"
  >
    <div
      role="tablist"
      aria-orientation="horizontal"
      class="flex gap-4"
    >
      <button
        v-for="tab in tabs"
        :id="idFor.tab(tab.id, id)"
        :key="tab.id"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :aria-controls="idFor.tabpanel(tab.id, id)"
        type="button"
        class="aria-[selected=true]:underline underline-offset-4"
        @click="activeTab = tab.id"
      >
        {{ tab.title }}
      </button>
    </div>
    <slot />
  </div>
</template>
