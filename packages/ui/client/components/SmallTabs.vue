<script setup lang="ts">
import { provide, ref, useId } from 'vue'
import { idFor, SMALL_TABS_CONTEXT } from '~/composables/small-tabs'

const activeTab = ref<string | null>(null)
const tabs = ref<{ name: string; title: string }[]>([])

function setActive(key: string) {
  activeTab.value = key
}

const id = useId()

provide(SMALL_TABS_CONTEXT, {
  id,
  activeTab,
  registerTab: (tab) => {
    if (!tabs.value.some(({ name }) => name === tab.name)) {
      tabs.value.push(tab)
    }

    if (tabs.value.length === 1) {
      setActive(tab.name)
    }
  },
  unregisterTab: (tab) => {
    const index = tabs.value.findIndex(({ name }) => name === tab.name)

    if (index > -1) {
      tabs.value.splice(index, 1)
    }
  },
})
</script>

<template>
  <div
    class="flex flex-col items-center gap-3"
  >
    <div
      role="tablist"
      aria-orientation="horizontal"
      class="flex gap-4"
    >
      <button
        v-for="tab in tabs"
        :id="idFor.tab(tab.name, id)"
        :key="tab.name"
        role="tab"
        :aria-selected="activeTab === tab.name"
        :aria-controls="idFor.tabpanel(tab.name, id)"
        type="button"
        class="aria-[selected=true]:underline underline-offset-4"
        @click="setActive(tab.name)"
      >
        {{ tab.title }}
      </button>
    </div>
    <slot />
  </div>
</template>
