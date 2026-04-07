<script setup lang="ts">
import type { RunnerTestCase } from 'vitest'
import { computed } from 'vue'
import { getAttachmentUrl, sanitizeFilePath } from '~/composables/attachments'
import { config } from '~/composables/client'
import { isDark } from '~/composables/dark'
import { mapLeveledTaskStacks } from '~/composables/error'
import { getLocationString, openLocation } from '~/composables/location'
import AnnotationAttachmentImage from '../AnnotationAttachmentImage.vue'
import Artifacts from '../artifacts/Artifacts.vue'
import FailureScreenshot from '../FailureScreenshot.vue'
import ViewReportError from './ViewReportError.vue'

const props = defineProps<{
  test: RunnerTestCase
}>()

const failed = computed(() => {
  if (!props.test.result || !props.test.result.errors?.length) {
    return null
  }
  return mapLeveledTaskStacks(isDark.value, [props.test])[0] as RunnerTestCase | null
})

const kWellKnownMeta = new Set([
  'benchmark',
  'typecheck',
])
const meta = computed(() => {
  return Object.entries(props.test.meta).filter(([name]) => {
    return !kWellKnownMeta.has(name)
  })
})
</script>

<template>
  <div h-full class="scrolls">
    <div v-if="failed">
      <div
        bg="red-500/10"
        text="red-500 sm"
        p="x3 y2"
        m-2
        rounded
      >
        <FailureScreenshot :task="test" />
        <div
          v-if="test.result?.htmlError"
          class="scrolls scrolls-rounded task-error"
          data-testid="task-error"
        >
          <pre v-html="test.result.htmlError" />
        </div>
        <template v-else-if="test.result?.errors && config.root">
          <ViewReportError
            v-for="(error, idx) of test.result.errors"
            :key="idx"
            :file-id="test.file.id"
            :error="error"
            :filename="test.file.name"
            :root="config.root"
          />
        </template>
      </div>
    </div>
    <template v-else>
      <div bg="green-500/10" text="green-500 sm" p="x4 y2" m-2 rounded>
        The test has passed without any errors
      </div>
    </template>
    <template v-if="test.annotations.length">
      <h1 m-2>
        Test Annotations
      </h1>
      <div
        v-for="annotation of test.annotations"
        :key="annotation.type + annotation.message"
        bg="yellow-500/10"
        text="yellow-500 sm"
        p="x3 y2"
        m-2
        rounded
        role="note"
      >
        <div flex="~ gap-2 items-center justify-between" overflow-hidden>
          <div class="flex gap-2" overflow-hidden>
            <span class="font-bold" ws-nowrap truncate>{{ annotation.type }}</span>
            <a
              v-if="annotation.attachment && !annotation.attachment.contentType?.startsWith('image/')"
              class="flex gap-1 items-center text-yellow-500/80 cursor-pointer"
              :href="getAttachmentUrl(annotation.attachment)"
              :download="sanitizeFilePath(annotation.message, annotation.attachment.contentType)"
            >
              <span class="i-carbon:download block" />
              Download
            </a>
          </div>
          <div>
            <span
              v-if="annotation.location && annotation.location.file === test.file.filepath"
              v-tooltip.bottom="'Open in Editor'"
              title="Open in Editor"
              class="flex gap-1 text-yellow-500/80 cursor-pointer"
              ws-nowrap
              @click="openLocation(test, annotation.location)"
            >
              {{ getLocationString(annotation.location) }}
            </span>
            <span
              v-else-if="annotation.location && annotation.location.file !== test.file.filepath"
              class="flex gap-1 text-yellow-500/80"
              ws-nowrap
            >
              {{ getLocationString(annotation.location) }}
            </span>
          </div>
        </div>

        <div
          class="scrolls scrolls-rounded task-error"
          data-testid="task-error"
        >
          {{ annotation.message }}
        </div>

        <AnnotationAttachmentImage :annotation="annotation" />
      </div>
    </template>
    <Artifacts :test="test" />
    <template v-if="meta.length">
      <h1 m-2>
        Test Meta
      </h1>
      <div
        bg="gray/10"
        text="black-100 sm"
        p="x3 y2"
        m-2
        rounded
        class="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2"
        overflow-hidden
      >
        <template v-for="([name, content]) of meta" :key="name">
          <div font-bold ws-nowrap truncate py-2>
            {{ name }}
          </div>
          <pre overflow-auto bg="gray/30" rounded p-2>{{ content }}</pre>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.task-error {
  --cm-ttc-c-thumb: #ccc;
}
html.dark .task-error {
  --cm-ttc-c-thumb: #444;
}
</style>
