<script setup lang="ts">
import contributors from '../../contributors.json'
</script>

<template>
  <div flex="~ wrap gap-1" justify-center>
    <a v-for="c of contributors" :key="c" :href="`https://github.com/${c}`" rel="noopener noreferrer" :aria-label="`${c} on GitHub`">
      <img loading="lazy" :src="`https://github.com/${c}.png`" rounded-full width="40" height="40" h-10 w-10 :alt="`${c}'s avatar`">
    </a>
  </div>
</template>
