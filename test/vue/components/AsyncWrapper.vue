<script setup lang="ts">
import AsyncComp from './AsyncComp.vue'

defineProps<{ delay: number }>()
</script>

<template>
  <Suspense>
    <AsyncComp :delay="delay" />
    <template #fallback>
      Fallback
    </template>
  </Suspense>
</template>
