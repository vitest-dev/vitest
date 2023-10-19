<script setup lang="ts">
import { computed, ref } from 'vue'

const { count } = defineProps<{ count: number }>()

const button = ref()
const times = ref(2)
const result = computed(() => count * times.value)

defineExpose({ count })
</script>

<template>
  <div>{{ count }} x {{ times }} = {{ result }}</div>
  <button ref="button" @click="times += 1">
    x1
  </button>
</template>
