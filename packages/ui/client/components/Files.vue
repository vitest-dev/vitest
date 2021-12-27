<script setup lang="ts">
import { activeFileIdRef, files, status } from '../state'
</script>

<template>
  <div overflow-auto flex-1>
    <div
      p="x4 y2"
      flex="~ gap-4"
      items-center
      bg-active
      border="b base"
    >
      <span font-light text-sm flex-1>
        Test Files
      </span>
      <span v-if="status === 'CONNECTING'" i-carbon-wifi text-orange-300 />
      <span v-else-if="status === 'CLOSED'" i-carbon-wifi-off text-red-300 />
      <button i-carbon-play-all />
    </div>

    <TestFile
      v-for="file in files"
      :key="file.id"
      :task="file"
      :active="activeFileIdRef === file.id"
      @click="activeFileIdRef = file.id"
    />
  </div>
</template>
