<script setup lang="ts">
defineProps<{ classes?: string }>()
</script>

<template>
  <div p-2 text-center inline-block bg-header rd-4 :class="classes">
    <div text-md>
      <slot name="header" />
    </div>
    <div text="4xl bold">
      <slot name="body" />
    </div>
    <template v-if="$slots.footer">
      <div text-md font-bold>
        <slot name="footer" />
      </div>
    </template>
  </div>
</template>
