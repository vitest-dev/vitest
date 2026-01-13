<script setup lang="ts">
import type { TestAttachment } from '@vitest/runner'
import { computed } from 'vue'
import { internalOrExternalUrl, isExternalAttachment } from '~/composables/attachments'
import VisualRegressionImageContainer from './VisualRegressionImageContainer.vue'

const { attachment } = defineProps<{
  attachment: TestAttachment
}>()

const href = computed<string>(() => internalOrExternalUrl(attachment))
</script>

<template>
  <VisualRegressionImageContainer>
    <a
      target="_blank"
      :href="href"
      :referrerPolicy="isExternalAttachment(attachment) ? 'no-referrer' : undefined"
    >
      <img
        :src="href"
      >
    </a>
  </VisualRegressionImageContainer>
</template>
