<template>
  <span class="box">
    <slot />
  </span>
</template>

<style scoped>
.box {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  text-align: center;
  border: 0.1rem solid var(--vp-c-brand-1);
  border-radius: 15px;
  padding: 1rem 2rem;
}
</style>
