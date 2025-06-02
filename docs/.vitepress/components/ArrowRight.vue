<template>
  <span class="arrow-right">
    <span class="arrow-line" />
    <span class="arrow-head" />
  </span>
</template>

<style scoped>
.arrow-right {
  display: flex;
  align-items: center;
}

.arrow-line {
  height: 0.2rem;
  width: 1rem;
  background-color: var(--vp-c-brand-1);
}

.arrow-head {
  height: 1rem;
  width: 1rem;
  background-color: var(--vp-c-brand-1);
  clip-path: polygon(0 0, 0% 100%, 100% 50%);
}
</style>
