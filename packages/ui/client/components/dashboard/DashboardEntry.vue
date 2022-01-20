<script setup lang="ts">
withDefaults(defineProps<{ tail?: boolean }>(), { tail: false })
</script>

<template>
  <div p-2 text-center flex>
    <div>
      <div text-4xl>
        <slot name="body" />
      </div>
      <div text-md>
        <slot name="header" />
      </div>
    </div>
    <div data-testid="tail" v-if="!tail" my-2 op50 w-1px bg-current origin-center rotate-15 translate-x-3 />
  </div>
</template>
