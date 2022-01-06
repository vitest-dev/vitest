<script setup lang="ts">
import contributors from '../../contributors.json'
</script>

<template>
  <div flex="~ wrap gap-1" justify-center>
    <a v-for="c of contributors" :key="c" :href="`https://github.com/${c}`">
      <img :src="`https://github.com/${c}.png`" rounded-full h-10 w-10>
    </a>
  </div>
</template>
