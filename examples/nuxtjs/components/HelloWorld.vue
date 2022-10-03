<template>
  <p>{{ message }}</p>
</template>

<script setup lang="ts">
interface BaseHelloWorldProps {
  message: string;
}

const props = defineProps<BaseHelloWorldProps>();
const { message } = toRefs(props);
</script>
