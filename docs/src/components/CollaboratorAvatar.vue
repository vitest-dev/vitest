<script setup lang="ts">
defineProps<{
  avatar: string
  name: string
  login: string
}>()
</script>

<template>
  <a :href="`https://github.com/${login}`" target="_blank">
    <img :title="name" :src="avatar" rounded-full h-16 w-16>
  </a>
</template>
