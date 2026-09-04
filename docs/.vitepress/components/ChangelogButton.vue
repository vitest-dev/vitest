<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  href: string
}>()
</script>

<template>
  <a :href="href" class="changelog-button" target="_blank" rel="noopener noreferrer">
    <Icon icon="carbon:document" aria-hidden="true" />
    <span>Changelog</span>
    <Icon icon="carbon:arrow-up-right" class="external-icon" aria-hidden="true" />
  </a>
</template>

<style scoped>
.changelog-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.5rem;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
  text-decoration: none;
  transition: background-color 150ms, border-color 150ms, transform 150ms;
}

.changelog-button:hover {
  border-color: color-mix(in srgb, var(--color-brand) 55%, transparent);
  background: color-mix(in srgb, var(--color-brand) 8%, var(--vp-c-bg-soft));
  color: var(--vp-c-text-1);
  transform: translateY(-1px);
}

.changelog-button:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 3px;
}

.changelog-button svg {
  width: 1rem;
  height: 1rem;
}

.changelog-button .external-icon {
  width: 0.75rem;
  height: 0.75rem;
  color: var(--vp-c-text-2);
}
</style>
