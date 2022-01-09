<script setup lang="ts">
const props = defineProps<{ total: number; failed: number; pass: number; inProgress: boolean }>()
const widthPass = computed(() => {
  const total = props.total
  return total > 0 ? (300 * props.pass / total) : 0
})
const widthFailed = computed(() => {
  const total = props.total
  return total > 0 ? (300 * props.failed / total) : 0
})
const pending = computed(() => {
  return props.total - props.failed - props.pass
})
const widthPending = computed(() => {
  const total = props.total
  return total > 0 ? (300 * pending.value / total) : 0
})
</script>

<template>
  <div h-8 line-height-1 px-0 grid="~ auto-cols-max" justify-items-center>
    <div h-1rem relative max-w-300px min-w-300px w-300px overflow-hidden class="px-0">
      <div
        absolute
        left-0
        top-0
        h-full
        line-height-1
        text-right
        bg-red5
        :class="[{'in-progress': props.inProgress}]"
        :style="`width: ${widthFailed}px;`"
      >
        <template v-if="!inProgress">
          <div vertical-align-middle c-white text-xs m="y-0 x-5px" ws-nowrap>
            {{ props.failed }}
          </div>
        </template>
      </div>
      <div
        absolute
        left-0
        top-0
        h-full
        line-height-1
        text-right
        bg-green5
        :class="[{'in-progress': props.inProgress}]"
        :style="`left: ${widthFailed}px; width: ${widthPass}px;`"
      >
        <template v-if="!inProgress">
          <div vertical-align-middle c-white text-xs m="y-0 x-5px" ws-nowrap>
            {{ props.pass }}
          </div>
        </template>
      </div>
      <div
        absolute
        left-0
        top-0
        h-full
        line-height-1
        text-right
        bg-yellow5
        class="test-bg-pending"
        :class="[{'in-progress': props.inProgress}]"
        :style="`left: ${widthPass + widthFailed}px; width: ${widthPending}px;`"
      >
        <template v-if="!inProgress">
          <div vertical-align-middle c-white font-size-12px m="y-0 x-5px" ws-nowrap>
            &#160;
          </div>
        </template>
      </div>
    </div>
    <div text-center text-xs>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.in-progress {
  background-image: linear-gradient(45deg, rgba(255, 255, 255, 0.15) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.15) 75%, transparent 75%, transparent);
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
