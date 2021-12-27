<script setup lang="ts">
const props = defineProps<{ promise: Promise<void> }>()

console.log(props.promise)

await props.promise
</script>

<template>
  <div>resolved</div>
</template>
