<script setup lang="ts">
import type { TestAnnotation } from 'vitest'
import { getAttachmentUrl, isExternalAttachment } from '~/composables/attachments'

const props = defineProps<{
  annotation: TestAnnotation
}>()

const href = computed<string>(() => {
  const attachment = props.annotation.attachment!
  const potentialUrl = attachment.path || attachment.body
  if (typeof potentialUrl === 'string' && (potentialUrl.startsWith('http://') || potentialUrl.startsWith('https://'))) {
    return potentialUrl
  }
  else {
    return getAttachmentUrl(attachment)
  }
})
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
