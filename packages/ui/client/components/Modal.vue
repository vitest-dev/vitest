<script setup lang="ts">
const { direction = 'bottom' } = defineProps<{
  direction?: string
}>()

const modelValue = defineModel<boolean>({ default: false })

const positionClass = computed(() => {
  switch (direction) {
    case 'bottom':
      return 'bottom-0 left-0 right-0 border-t'
    case 'top':
      return 'top-0 left-0 right-0 border-b'
    case 'left':
      return 'bottom-0 left-0 top-0 border-r'
    case 'right':
      return 'bottom-0 top-0 right-0 border-l'
    default:
      return ''
  }
})

const transform = computed(() => {
  switch (direction) {
    case 'bottom':
      return 'translateY(100%)'
    case 'top':
      return 'translateY(-100%)'
    case 'left':
      return 'translateX(-100%)'
    case 'right':
      return 'translateX(100%)'
    default:
      return ''
  }
})

const closeModal = () => (modelValue.value = false)
</script>

<template>
  <div
    class="fixed inset-0 z-40"
    :class="modelValue ? '' : 'pointer-events-none'"
  >
    <div
      class="bg-base inset-0 absolute transition-opacity duration-500 ease-out"
      :class="modelValue ? 'opacity-50' : 'opacity-0'"
      @click="closeModal"
    />
    <div
      class="bg-base border-base absolute transition-all duration-200 ease-out scrolls"
      :class="[positionClass]"
      :style="modelValue ? {} : { transform }"
    >
      <slot />
    </div>
  </div>
</template>
