<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{ count: number }>()

const times = ref(2)
const result = computed(() => props.count * times.value)

defineExpose(props)
</script>

<template>
  <div>{{ count }} x {{ times }} = {{ result }}</div>
  <button @click="times += 1">
    x1
  </button>
</template>

<!-- Style block triggers a specific condition where sourcemaps used to break randomly -->
<!-- https://github.com/vitest-dev/vitest/issues/8154 -->
<style lang="scss">
body {
  background-color: #FFF;
}
</style>
