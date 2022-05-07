<script setup lang="ts">
const props = defineProps<{ count: number }>()
const times = ref(2)
const result = computed(() => props.count * times.value)

defineExpose(props)
</script>

<template>
  <Foo>
    <div>{{ count }} x {{ times }} = {{ result }}</div>
    <button @click="times += 1">
      x1
    </button>
  </Foo>
</template>
