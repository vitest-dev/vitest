<script setup lang="ts">
import { isDark, toggleDark } from '~/composables'
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
  </nav>
</template>
