<script setup lang="ts">
import type { VisualRegressionArtifact } from '@vitest/runner'
import { computed, ref, useId } from 'vue'
import { internalOrExternalUrl } from '~/composables/attachments'
import VisualRegressionImageContainer from './VisualRegressionImageContainer.vue'

type AttachmentWithMeta = Exclude<VisualRegressionArtifact['attachments'][number], { name: 'diff' }>

const { actual, reference } = defineProps<{
  reference: AttachmentWithMeta
  actual: AttachmentWithMeta
}>()

const referenceUrl = computed(() => internalOrExternalUrl(reference))
const actualUrl = computed(() => internalOrExternalUrl(actual))

const maxWidth = computed(() =>
  Math.max(reference.width, actual.width),
)
const maxHeight = computed(() =>
  Math.max(reference.height, actual.height),
)

const splitPercentage = ref(50)

const inputId = useId()
</script>

<template>
  <VisualRegressionImageContainer>
    <div
      aria-label="Image comparison slider showing reference and actual screenshots"
      class="relative max-w-full h-full overflow-hidden"
      :style="{
        '--split': `${splitPercentage}%`,
        'aspectRatio': `${maxWidth} / ${maxHeight}`,
        'width': `${maxWidth}px`,
      }"
    >
      <div
        class="absolute w-full h-full place-content-center place-items-center [clip-path:polygon(0%_0%,var(--split)_0%,var(--split)_100%,0%_100%)]"
        aria-hidden="true"
        role="presentation"
      >
        <img :src="referenceUrl">
      </div>
      <div
        class="absolute w-full h-full place-content-center place-items-center [clip-path:polygon(var(--split)_0%,100%_0%,100%_100%,var(--split)_100%)]"
        aria-hidden="true"
        role="presentation"
      >
        <img :src="actualUrl">
      </div>
      <div
        class="absolute left-[--split] h-full w-[2px] -translate-x-1/2 bg-white shadow-[0_0_3px_rgb(0_0_0/.2),0_0_10px_rgb(0_0_0/.5)] before:content-[''] before:absolute before:top-1/2 before:size-[16px] before:bg-white before:border-[2px] before:border-black before:rounded-full before:-translate-y-1/2 before:translate-x-[calc(-50%+1px)]"
        aria-hidden="true"
        role="presentation"
      />
      <input
        :id="inputId"
        v-model="splitPercentage"
        type="range"
        min="0"
        max="100"
        step="0.1"
        aria-label="Adjust slider to compare reference and actual images"
        class="absolute inset-0 opacity-0 cursor-col-resize"
      >
      <output :for="inputId" class="sr-only">
        Showing {{ splitPercentage }}% reference, {{ 100 - splitPercentage }}% actual
      </output>
    </div>
  </VisualRegressionImageContainer>
</template>
