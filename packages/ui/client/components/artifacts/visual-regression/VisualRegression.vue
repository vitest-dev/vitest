<script setup lang="ts">
import type { VisualRegressionArtifact } from '@vitest/runner'
import { computed } from 'vue'
import ArtifactTemplate from '../ArtifactTemplate.vue'
import SmallTabs from './SmallTabs.vue'
import SmallTabsPane from './SmallTabsPane.vue'
import VisualRegressionImage from './VisualRegressionImage.vue'
import VisualRegressionSlider from './VisualRegressionSlider.vue'

const { regression } = defineProps<{
  regression: VisualRegressionArtifact
}>()

type AttachmentWithMeta = Exclude<VisualRegressionArtifact['attachments'][number], { name: 'diff' }>

const groups = computed(() => ({
  diff: regression.attachments.find(artifact => artifact.name === 'diff'),
  reference: regression.attachments.find((artifact): artifact is AttachmentWithMeta => artifact.name === 'reference'),
  actual: regression.attachments.find((artifact): artifact is AttachmentWithMeta => artifact.name === 'actual'),
}))
</script>

<template>
  <ArtifactTemplate>
    <template #title>
      Visual Regression
    </template>
    <template #message>
      {{ regression.message }}
    </template>
    <SmallTabs>
      <SmallTabsPane v-if="groups.diff" title="Diff">
        <VisualRegressionImage :attachment="groups.diff" />
      </SmallTabsPane>
      <SmallTabsPane v-if="groups.reference" title="Reference">
        <VisualRegressionImage :attachment="groups.reference" />
      </SmallTabsPane>
      <SmallTabsPane v-if="groups.actual" title="Actual">
        <VisualRegressionImage :attachment="groups.actual" />
      </SmallTabsPane>
      <SmallTabsPane v-if="groups.reference && groups.actual" title="Slider">
        <VisualRegressionSlider :actual="groups.actual" :reference="groups.reference" />
      </SmallTabsPane>
    </SmallTabs>
  </ArtifactTemplate>
</template>
