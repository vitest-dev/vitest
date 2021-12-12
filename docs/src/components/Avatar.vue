<script setup lang="ts">
defineProps<{
  avatar: string
  name: string
  github: string
  twitter: string
}>()
</script>

<template>
  <div text-center>
    <img :src="avatar" rounded-full h-30 w-30>
    <div text-2xl mt-1 mb-1>
      {{ name }}
    </div>
    <div op60>
      <slot />
    </div>
    <div flex="~ inline gap-2" py-4 text-2xl>
      <a
        class="i-carbon-logo-github inline-block text-current op30 hover:op100 mya transition duration-200"
        :href="`https://github.com/${github}`"
        target="_blank"
      />
      <a
        class="i-carbon-logo-twitter inline-block text-1.3em mya text-current op30 hover:op100 transition duration-200"
        :href="`https://twitter.com/${twitter}`"
        target="_blank"
      />
    </div>
    <br>
    <a
      class="btn mt-5 bg-pink-500 hover:bg-pink-600"
      target="_blank"
      :href="`https://github.com/sponsors/${github}`"
    >
      <span class="i-carbon-favorite-filled inline-block" />
      Sponsor
    </a>
  </div>
</template>
