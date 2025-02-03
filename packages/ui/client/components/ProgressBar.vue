<script setup lang="ts">
import { finished } from '~/composables/client/state'
import { explorerTree } from '~/composables/explorer'

const { width } = useWindowSize()
const classes = computed(() => {
  return [
    explorerTree.summary.files === 0 && '!bg-gray-4 !dark:bg-gray-7',
    !finished.value && 'in-progress',
  ].filter(Boolean).join(' ')
})

const widthPass = computed(() => {
  const t = explorerTree.summary.files
  return t > 0 ? (width.value * explorerTree.summary.filesSuccess / t) : 0
})
const widthFailed = computed(() => {
  const t = explorerTree.summary.files
  return t > 0 ? (width.value * explorerTree.summary.filesFailed / t) : 0
})
const pending = computed(() => {
  const t = explorerTree.summary.files
  return t - explorerTree.summary.filesFailed - explorerTree.summary.filesSuccess
})
const widthPending = computed(() => {
  const t = explorerTree.summary.files
  return t > 0 ? (width.value * pending.value / t) : 0
})
</script>

<template>
  <div
    absolute
    t-0
    l-0
    r-0
    z-index-1031
    pointer-events-none
    p-0
    h-3px
    grid="~ auto-cols-max"
    justify-items-center
    w-screen
    :class="classes"
  >
    <div h-3px relative overflow-hidden class="px-0" w-screen>
      <div
        absolute
        l-0
        t-0
        bg-red5
        h-3px
        :class="classes"
        :style="`width: ${widthFailed}px;`"
      >
        &#160;
      </div>
      <div
        absolute
        l-0
        t-0
        bg-green5
        h-3px
        :class="classes"
        :style="`left: ${widthFailed}px; width: ${widthPass}px;`"
      >
        &#160;
      </div>
      <div
        absolute
        l-0
        t-0
        bg-yellow5
        h-3px
        :class="classes"
        :style="`left: ${widthPass + widthFailed}px; width: ${widthPending}px;`"
      >
        &#160;
      </div>
    </div>
  </div>
</template>

<style scoped>
.in-progress {
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.15) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.15) 75%,
    transparent 75%,
    transparent
  );
  background-size: 40px 40px;
  animation: in-progress-stripes 2s linear infinite;
}
@keyframes in-progress-stripes {
  from {
    background-position: 40px 0;
  }
  to {
    background-position: 0 0;
  }
}
</style>
