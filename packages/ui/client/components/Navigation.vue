<script setup lang="ts">
import { isDark, toggleDark } from '~/composables'
</script>

<template>
  <nav
    bg-panel
    w-72
    flex
    flex-col
    border="r base"
  >
    <div
      grid="~ cols-[max-content,1fr,min-content] gap-2"
      items-center
      px-4
      h-14
      border="b base"
    >
      <img w-6 h-6 src="/favicon.svg">
      <span text-lg font-light>Vitest</span>
      <button
        text-xl
        text-dark-100
        dark:text-light-900
        dark:i-carbon-moon
        i-carbon-sun
        @click="toggleDark()"
      />
    </div>
    <Files />
  </nav>
</template>
