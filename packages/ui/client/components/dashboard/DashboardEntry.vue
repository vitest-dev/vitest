<script setup lang="ts">
defineProps<{ classes?: string }>()
</script>

<template>
  <div p-2 text-center inline-block rd-4 min-w-75px :class="classes">
    <div text-md>
      <slot name="header" />
    </div>
    <div text="4xl bold">
      <slot name="body" />
    </div>
  </div>
</template>
