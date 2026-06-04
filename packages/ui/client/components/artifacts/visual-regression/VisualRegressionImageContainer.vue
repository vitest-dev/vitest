<script setup lang="ts">
const checkeredBackground = `url("${
  CSS.escape('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><path d="M1 2V0h1v1H0v1z" fill-opacity=".05"/></svg>')
}")`
</script>

<template>
  <div
    class="max-w-full w-fit mx-auto bg-[size:16px_16px] bg-[#fafafa] dark:bg-[#3a3a3a] bg-center p-4 rounded user-select-none outline-0 outline-black dark:outline-white outline-offset-4 outline-solid focus-within:has-focus-visible:outline-2"
    :style="{ backgroundImage: checkeredBackground }"
  >
    <slot />
  </div>
</template>
