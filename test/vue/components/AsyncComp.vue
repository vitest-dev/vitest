<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ delay: number }>()

const time = ref(Date.now())

await new Promise(resolve => setTimeout(resolve, props.delay))

time.value = Date.now() - time.value
</script>

<template>
  <div>{{ time }}</div>
</template>
