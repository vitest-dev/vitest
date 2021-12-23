<script setup lang="ts">
import { isDark, toggleDark } from '~/composables'

</script>

<template>
  <nav
    top-4
    left-4
    bottom-4
    fixed
    bg-light-300
    dark:bg-dark-600
    w-72
    border-1
    border-rounded
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
      h-14
      border-b-1
      border-light-900
      dark:border-dark-200
    >
      <img w-6 h-6 src="/favicon.svg">
      <span text-lg font-light>Vitest</span>
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
    <Suites />
  </nav>
</template>
