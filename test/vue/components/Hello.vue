<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ count: number }>()

const double = computed(() => props.count * 2)

defineExpose(props)
</script>

<template>
  <div>{{count}} x 2 = {{double}}</div>
</template>
