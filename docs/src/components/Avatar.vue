<script setup lang="ts">
import type { CoreTeam } from '../contributors'
import { lazyLoad } from '../images'

defineProps<{
  avatar: CoreTeam['avatar']
  name: CoreTeam['name']
  github: CoreTeam['github']
  twitter: CoreTeam['twitter']
  sponsors: CoreTeam['sponsors']
  description: CoreTeam['description']
}>()
</script>

<template>
  <div text-center>
    <img :loading="lazyLoad" :src="avatar" rounded-full min-w-25 min-h-25 h-25 w-25 :alt="`${name}'s avatar`">
    <div text-xl mt-1 mb-1>
      {{ name }}
    </div>
    <div op60 v-html="description" />
    <div flex="~ inline gap-2" py-4 text-2xl>
      <a
        class="i-carbon-logo-github inline-block text-current op30 hover:op100 mya transition duration-200"
        :href="`https://github.com/${github}`"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="`${name} on GitHub`"
      />
      <a
        v-if="twitter"
        class="i-carbon-logo-twitter inline-block text-1.3em mya text-current op30 hover:op100 transition duration-200"
        :href="`https://twitter.com/${twitter}`"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="`${name} on Twitter`"
      />
    </div>
    <br>
    <a
      v-if="sponsors"
      class="btn mt-1 bg-pink-500 hover:bg-pink-600"
      target="_blank"
      rel="noopener noreferrer"
      :href="`https://github.com/sponsors/${github}`"
    >
      <span class="i-carbon-favorite-filled inline-block" />
      Sponsor
    </a>
  </div>
</template>
