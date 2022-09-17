<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{ count: number }>()

const times = ref(2)
const result = computed(() => props.count * times.value)
</script>

<template>
  <div>
    <div>{{ count }} x {{ times }} = {{ result }}</div>
    <button @click="times += 1">
      x1
    </button>
  </div>
</template>
