<script setup lang="ts">
defineProps<{
  avatar: string
  name: string
  github: string
  twitter?: string
  sponsors?: boolean
}>()
</script>

<template>
  <div text-center>
    <img :src="avatar" rounded-full h-25 w-25>
    <div text-xl mt-1 mb-1>
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
        v-if="twitter"
        class="i-carbon-logo-twitter inline-block text-1.3em mya text-current op30 hover:op100 transition duration-200"
        :href="`https://twitter.com/${twitter}`"
        target="_blank"
      />
    </div>
    <br>
    <a
      v-if="sponsors"
      class="btn mt-1 bg-pink-500 hover:bg-pink-600"
      target="_blank"
      :href="`https://github.com/sponsors/${github}`"
    >
      <span class="i-carbon-favorite-filled inline-block" />
      Sponsor
    </a>
  </div>
</template>
