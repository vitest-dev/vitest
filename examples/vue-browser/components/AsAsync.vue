<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'

const Hello = defineAsyncComponent({
  loader: () => import('./Hello.vue'),
  delay: 0,
})

const showHello = ref(false)
</script>

<template>
  <button @click="showHello = true">
    Show Hello
  </button>
  <div v-if="showHello">
    <div>Async component</div>
    <Hello :count="1" />
  </div>
</template>
