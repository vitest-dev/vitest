<script setup lang="ts">
import TestSuite from './TestSuite.vue'
import { isDark, toggleDark } from '~/composables'

const { data, isFetching } = useFetch('/__vitest_api').json()
</script>

<template>
  <nav
    bg-light-300
    dark:bg-dark-600
    h-screen
    w-72
    border-r-1
    border-light-900
    dark:border-dark-200
    flex
    flex-col
  >
    <div
      grid="~ cols-[max-content,1fr,min-content]"
      gap-2
      items-center
      px-4
      h-16
      border-b-1
      border-light-900
      dark:border-dark-200
    >
      <img w-8 h-8 src="/favicon.svg">
      <span text-xl font-light>Vitest</span>
      <button
        text-xl
        text-dark-100
        dark:text-light-900
        :class="{
          'i-carbon-moon': isDark,
          'i-carbon-sun': !isDark
        }"
        @click="toggleDark"
      />
    </div>

    <div overflow-auto flex-1>
      <div
        flex
        flex-row
        items-center
        text-lg
        px-4
        pt-4
        text-light-900
      >
        <span>Test Suites</span>
      </div>
      <template v-if="data && data.suites">
        <TestSuite v-for="suite in data.suites" :key="suite.id" v-bind="{...suite}" />
      </template>
    </div>
  </nav>
</template>
