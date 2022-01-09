<script setup lang="ts">
defineProps<{
  color?: string
}>()

const open = ref(true)
</script>

<template>
  <div :open="open" class="details-panel" @toggle="open = $event.target.open">
    <div p="y1" text-sm items-center gap-2 :class="color" w-full flex select-none cursor-pointer>
      <div flex-1 h-1px border="base b" op80 />
      <slot name="summary" :open="open" />
      <div flex-1 h-1px border="base b" op80 />
    </div>
    <slot />
  </div>
</template>

<style>
.details-panel {
  user-select: none;
  width: 100%;
}
</style>
