<script setup lang="ts">
import { current } from '~/composables/client'
</script>

<template>
  <div grid="~ cols-[15rem_auto]" h-screen w-screen overflow="hidden">
    <Navigation />
    <ModuleGraph :filepath="current?.filepath" />
  </div>
  <ConnectionOverlay />
</template>
