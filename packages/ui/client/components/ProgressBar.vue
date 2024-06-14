<script setup lang="ts">
import { files } from "~/composables/client";
import { filesFailed, filesSuccess, finished } from "~/composables/summary";

const { width } = useWindowSize();
const classes = computed(() => {
  // if there is no files, then in progress and gray
  if (files.value.length === 0) return "!bg-gray-4 !dark:bg-gray-7 in-progress";
  else if (!finished.value) return "in-progress";

  return null;
});
const total = computed(() => files.value.length);
const pass = computed(() => filesSuccess.value.length);
const failed = computed(() => filesFailed.value.length);

const widthPass = computed(() => {
  const t = unref(total);
  return t > 0 ? (width.value * pass.value) / t : 0;
});
const widthFailed = computed(() => {
  const t = unref(total);
  return t > 0 ? (width.value * failed.value) / t : 0;
});
const pending = computed(() => {
  const t = unref(total);
  return t - failed.value - pass.value;
});
const widthPending = computed(() => {
  const t = unref(total);
  return t > 0 ? (width.value * pending.value) / t : 0;
});
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
