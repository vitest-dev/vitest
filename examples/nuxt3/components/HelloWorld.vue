<script setup lang="ts">
interface BaseHelloWorldProps {
  message: string
}

const props = defineProps<BaseHelloWorldProps>()
const { message } = toRefs(props)
</script>

<template>
  <p>{{ message }}</p>
</template>
