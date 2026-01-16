<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { until, useElementVisibility } from '@vueuse/core'
import { computed, effectScope, onMounted, ref } from 'vue'

const el = ref<HTMLDivElement>()
const state = ref(0)

function reset() {
  state.value = 0
  setTimeout(() => {
    state.value = Math.random() > 0.9 ? 2 : 1
    if (state.value === 2) {
      setTimeout(reset, 1000)
    }
  }, Math.round(Math.random() * 3000) + 400)
}

const color = computed(() => {
  return {
    '--vp-c-brand-1': state.value === 1
      ? 'var(--color-brand)'
      : state.value === 2
        ? 'var(--vp-c-red-1)'
        : 'var(--vp-c-yellow-1)',
  } as any
})

const scope = effectScope()

const visibility = scope.run(() => useElementVisibility(el))

onMounted(async () => {
  await until(visibility).toBe(true)

  scope.stop()
  reset()
})
</script>

<template>
  <li :style="color">
    <div ref="el" class="icon-container">
      <div class="icon-wrapper" :class="state ? 'flip' : ''">
        <Icon icon="carbon:circle-dash" class="icon-spinner" width="1.2em" height="1.2em" />
      </div>
      <div class="icon-wrapper" :class="state === 2 ? '' : 'flip'">
        <Icon icon="carbon:close-outline" class="icon-error" width="1.2em" height="1.2em" />
      </div>
      <div class="icon-wrapper" :class="state === 1 ? '' : 'flip'">
        <Icon icon="carbon:checkmark-outline" class="icon-success" width="1.2em" height="1.2em" />
      </div>
    </div>
    <div>
      <slot />
    </div>
  </li>
</template>

<style scoped>
.icon-container {
  position: relative;
  width: 1.2em;
  height: 1.2em;
  flex: none;
  margin-top: auto;
  margin-bottom: auto;
  vertical-align: middle;
}

.icon-wrapper {
  position: absolute;
  transition: all 300ms;
}

.flip {
  transform: rotateY(90deg);
}

.icon-spinner {
  animation: spin 1s linear infinite;
  color: var(--vp-c-yellow-1);
}

.icon-error {
  color: var(--vp-c-red-1);
}

.icon-success {
  color: var(--color-brand);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
