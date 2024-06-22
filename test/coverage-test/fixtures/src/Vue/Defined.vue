<script setup lang="ts">
const defined = 'hello'

/* eslint-disable no-console */
if (defined) {
  console.log('Covered condition')
}
else {
  console.log('Uncovered condition')
}
</script>

<template>
  {{ defined }}
</template>

<!-- Style block triggers a specific condition where sourcemaps used to break randomly -->
<style lang="css" scoped>
body {
  background-color: #FFF;
}
</style>
