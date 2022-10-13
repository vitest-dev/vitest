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
<!--
    <div v-if="!tail" data-testid="tail" my-0 op50 w-2px bg-current origin-center rotate-0 translate-x-3 />
-->
  </div>
</template>
