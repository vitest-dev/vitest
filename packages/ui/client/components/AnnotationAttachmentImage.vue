<script setup lang="ts">
import type { TestAnnotation } from 'vitest'
import { computed } from 'vue'
import { internalOrExternalUrl, isExternalAttachment } from '~/composables/attachments'

const props = defineProps<{
  annotation: TestAnnotation
}>()

const href = computed<string>(() => internalOrExternalUrl(props.annotation.attachment!))
</script>

<template>
  <a
    v-if="annotation.attachment && annotation.attachment.contentType?.startsWith('image/')"
    target="_blank"
    class="inline-block mt-2"
    :style="{ maxWidth: '600px' }"
    :href="href"
    :referrerPolicy="isExternalAttachment(annotation.attachment) ? 'no-referrer' : undefined"
  >
    <img
      :src="href"
    >
  </a>
</template>
