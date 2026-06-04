<script setup lang="ts">
import { useSlots } from 'vue'

const slots = useSlots()
</script>

<template>
  <article class="flex flex-col gap-4">
    <h1>
      <slot name="title" />
    </h1>
    <p v-if="slots.message">
      <slot name="message" />
    </p>
    <slot />
  </article>
</template>
