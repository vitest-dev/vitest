<script setup lang="ts">
// const { tail = false } = defineProps<{ tail?: boolean }>()
</script>

<template>
  <div p-2 text-center flex>
    <div>
      <div text-4xl min-w-2em>
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
