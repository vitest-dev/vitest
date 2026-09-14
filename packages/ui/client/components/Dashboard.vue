<script setup lang="ts">
import DetailsHeaderButtons from '~/components/DetailsHeaderButtons.vue'
import { browserState } from '~/composables/client'
import TestsFilesContainer from './dashboard/TestsFilesContainer.vue'
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="p-3 h-10 flex gap-2 items-center bg-header border-b border-base">
      <div class="i-carbon-dashboard" />
      <span class="pl-1 font-bold text-sm flex-auto ws-nowrap overflow-hidden truncate">Dashboard</span>
      <DetailsHeaderButtons v-if="browserState" />
    </div>
    <div class="scrolls flex-auto py-1">
      <TestsFilesContainer />
    </div>
  </div>
</template>
