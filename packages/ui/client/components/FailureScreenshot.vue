<script setup lang="ts">
import type { RunnerTask } from 'vitest'
import { computed, ref } from 'vue'
import { getAttachmentUrl } from '~/composables/attachments'
import { isReport } from '~/constants'
import IconButton from './IconButton.vue'
import Modal from './Modal.vue'
import ScreenshotError from './views/ScreenshotError.vue'

const { task } = defineProps<{
  task: RunnerTask
}>()

const showScreenshot = ref(false)
const artifact = computed(() => {
  if (task.type === 'test') {
    const artifact = task.artifacts.find(artifact => artifact.type === 'internal:failureScreenshot')

    if (artifact !== undefined) {
      return artifact
    }
  }

  return null
})
const screenshotUrl = computed(() =>
  artifact.value && artifact.value.attachments.length && getAttachmentUrl(artifact.value.attachments[0]),
)

function openScreenshot() {
  if (artifact.value === null || artifact.value.attachments.length === 0) {
    return
  }

  const filePath = artifact.value.attachments[0].originalPath

  fetch(`/__open-in-editor?file=${encodeURIComponent(filePath)}`)
}
</script>

<template>
  <template v-if="screenshotUrl">
    <div flex="~ gap-2 items-center">
      <IconButton
        v-tooltip.bottom="'View screenshot error'"
        class="!op-100"
        icon="i-carbon:image"
        title="View screenshot error"
        @click="showScreenshot = true"
      />
      <!-- in a report there is no dev server to handle the action -->
      <IconButton
        v-if="!isReport"
        v-tooltip.bottom="'Open screenshot error in editor'"
        class="!op-100"
        icon="i-carbon:image-reference"
        title="Open screenshot error in editor"
        @click="openScreenshot"
      />
    </div>
    <Modal :key="screenshotUrl" v-model="showScreenshot" direction="right">
      <ScreenshotError
        :file="task.file.filepath"
        :name="task.name"
        :url="screenshotUrl"
        @close="showScreenshot = false"
      />
    </Modal>
  </template>
</template>
