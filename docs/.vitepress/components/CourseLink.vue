<script setup lang="ts">
defineProps<{
  href: string
}>()
</script>

<template>
  <a :href="href" target="_blank" class="un-bg-green-500/10 un-px-4 un-py-3 un-rounded un-block un-mt-2 un-flex un-items-center un-gap-2">
    <div i-carbon:play-filled class="un-flex-none un-text-lg" />
    <slot />
  </a>
</template>
