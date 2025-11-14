<script setup lang="ts">
import type { TestAnnotation } from 'vitest'
import { computed } from 'vue'
import SmallTabs from './SmallTabs.vue'
import SmallTabsPane from './SmallTabsPane.vue'
import VisualRegressionImage from './VisualRegressionImage.vue'
import VisualRegressionSlider from './VisualRegressionSlider.vue'

const { annotation } = defineProps<{
  annotation: TestAnnotation
}>()

if (annotation.metadata?.['internal:toMatchScreenshot'] === undefined) {
  throw new Error('VisualRegression needs "internal:toMatchScreenshot" to work')
}

if (!Array.isArray(annotation.attachments) || annotation.attachments.length === 0) {
  throw new Error('VisualRegression needs at least one attachment to work')
}

const groups = computed(() => ({
  diff: annotation.attachments?.find(attachment => attachment.name === 'diff'),
  reference: annotation.attachments?.find(attachment => attachment.name === 'reference'),
  actual: annotation.attachments?.find(attachment => attachment.name === 'actual'),
}))
</script>

<template>
  <SmallTabs>
    <SmallTabsPane v-if="groups.diff" name="diff" title="Diff">
      <VisualRegressionImage :attachment="groups.diff" />
    </SmallTabsPane>
    <SmallTabsPane v-if="groups.reference" name="reference" title="Reference">
      <VisualRegressionImage :attachment="groups.reference" />
    </SmallTabsPane>
    <SmallTabsPane v-if="groups.actual" name="actual" title="Actual">
      <VisualRegressionImage :attachment="groups.actual" />
    </SmallTabsPane>
    <SmallTabsPane v-if="groups.reference && groups.actual" name="slider" title="Slider">
      <VisualRegressionSlider :actual="groups.actual" :reference="groups.reference" />
    </SmallTabsPane>
  </SmallTabs>
</template>
