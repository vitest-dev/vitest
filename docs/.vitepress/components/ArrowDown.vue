<template>
  <span class="arrow-down">
    <span class="arrow-line" />
    <span class="arrow-head" />
  </span>
</template>

<style scoped>
.arrow-down {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.arrow-line {
  height: 1rem;
  width: 0.2rem;
  background-color: var(--vp-c-brand-1);
}

.arrow-head {
  height: 1rem;
  width: 1rem;
  background-color: var(--vp-c-brand-1);
  clip-path: polygon(100% 0, 0 0, 50% 100%);
}
</style>
