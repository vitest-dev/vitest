<script setup lang="ts">
import { contributors } from '../contributors'
import { lazyLoad } from '../images'
</script>
<template>
  <div flex="~ wrap gap-1" justify-center>
    <a v-for="{ name, avatar } of contributors" :key="name" :href="`https://github.com/${name}`" rel="noopener noreferrer" :aria-label="`${name} on GitHub`">
      <img :src="avatar" rounded-full h-10 w-10 :alt="`${name}'s avatar`">
    </a>
  </div>
</template>
