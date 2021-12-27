<script setup lang="ts">
const props = defineProps<{ promise: Promise<void> }>()

await props.promise
</script>

<template>
  <div>resolved</div>
</template>
