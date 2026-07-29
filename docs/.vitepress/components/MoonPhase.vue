<script setup lang="ts">
const phases = [
  { emoji: '🌑', alt: 'new moon' },
  { emoji: '🌒', alt: 'waxing crescent moon' },
  { emoji: '🌓', alt: 'first quarter moon' },
  { emoji: '🌔', alt: 'waxing gibbous moon' },
  { emoji: '🌕', alt: 'full moon' },
  { emoji: '🌖', alt: 'waning gibbous moon' },
  { emoji: '🌗', alt: 'last quarter moon' },
  { emoji: '🌘', alt: 'waning crescent moon' },
]

const phase = phases[
  Math.floor(Math.random() * phases.length)
]
</script>

<template>
  <span :aria-label="phase.alt">{{ phase.emoji }}</span>
</template>
