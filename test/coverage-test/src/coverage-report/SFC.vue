<script lang="ts">
import { defineComponent, ref } from 'vue'

export default defineComponent({
  setup() {
    const count = ref(0)

    return { count }
  },
})
</script>

<template>
  <button @click="count++">
    {{ count }}
  </button>
</template>
