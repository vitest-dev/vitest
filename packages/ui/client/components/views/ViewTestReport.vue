<script setup lang="ts">
import type { TestAnnotation, TestAnnotationLocation } from '@vitest/runner'
import type Convert from 'ansi-to-html'
import type { ErrorWithDiff, File, RunnerTestCase, Task } from 'vitest'
import { relative } from 'pathe'
import { getAttachmentUrl, sanitizeFilePath } from '~/composables/attachments'
import { browserState, config } from '~/composables/client'
import { showAnnotationSource } from '~/composables/codemirror'
import { isDark } from '~/composables/dark'
import { createAnsiToHtmlFilter } from '~/composables/error'
import { escapeHtml } from '~/utils/escape'

declare module '@vitest/runner' {
  interface TaskResult {
    htmlError?: string
  }
}

const props = defineProps<{
  file: File
  test: RunnerTestCase
}>()

function createHtmlError(filter: Convert, error: ErrorWithDiff) {
  let htmlError = ''
  if (error.message?.includes('\x1B')) {
    htmlError = `<b>${error.name}</b>: ${filter.toHtml(
      escapeHtml(error.message),
    )}`
  }

  const startStrWithX1B = error.stack?.includes('\x1B')
  if (startStrWithX1B) {
    if (htmlError.length > 0) {
      htmlError += filter.toHtml(
        escapeHtml((error.stack) as string),
      )
    }
    else {
      htmlError = `<b>${error.name}</b>: ${
        error.message
      }${filter.toHtml(
        escapeHtml((error.stack) as string),
      )}`
    }
  }

  if (htmlError.length > 0) {
    return htmlError
  }
  return null
}

function mapLeveledTaskStacks(dark: boolean, tasks: RunnerTestCase[]) {
  const filter = createAnsiToHtmlFilter(dark)
  return tasks.map((t) => {
    const result = t.result
    if (!result || result.htmlError) {
      return t
    }
    const errors = result.errors
      ?.map(error => createHtmlError(filter, error))
      .filter(error => error != null)
      .join('<br><br>')
    if (errors?.length) {
      result.htmlError = errors
    }
    return t
  })
}

const failed = computed(() => {
  if (!props.test.result || !props.test.result.errors?.length) {
    return []
  }
  return mapLeveledTaskStacks(isDark.value, [props.test])
})

function openScreenshot(task: Task) {
  const filePath = task.meta?.failScreenshotPath
  if (filePath) {
    fetch(`/__open-in-editor?file=${encodeURIComponent(filePath)}`)
  }
}

function openAnnotation(annotation: TestAnnotation) {
  return showAnnotationSource(props.test, annotation)
}

const showScreenshot = ref(false)
const timestamp = ref(Date.now())
const currentTask = ref<Task | undefined>()
const currentScreenshotUrl = computed(() => {
  const id = currentTask.value?.id
  // force refresh
  const t = timestamp.value
  // browser plugin using /, change this if base can be modified
  return id ? `/__screenshot-error?id=${encodeURIComponent(id)}&t=${t}` : undefined
})

function showScreenshotModal(task: Task) {
  currentTask.value = task
  timestamp.value = Date.now()
  showScreenshot.value = true
}

function getLocationString(location: TestAnnotationLocation) {
  const path = relative(config.value.root, location.file)
  return `${path}:${location.line}:${location.column}`
}

const kWellKnownMeta = new Set([
  'benchmark',
  'failScreenshotPath',
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
    <template v-if="failed.length">
      <div v-for="task of failed" :key="task.id">
        <div
          bg="red-500/10"
          text="red-500 sm"
          p="x3 y2"
          m-2
          rounded
        >
          <div flex="~ gap-2 items-center">
            <template v-if="browserState && task.meta?.failScreenshotPath">
              <IconButton
                v-tooltip.bottom="'View screenshot error'"
                class="!op-100"
                icon="i-carbon:image"
                title="View screenshot error"
                @click="showScreenshotModal(task)"
              />
              <IconButton
                v-tooltip.bottom="'Open screenshot error in editor'"
                class="!op-100"
                icon="i-carbon:image-reference"
                title="Open screenshot error in editor"
                @click="openScreenshot(task)"
              />
            </template>
          </div>
          <div
            v-if="task.result?.htmlError"
            class="scrolls scrolls-rounded task-error"
            data-testid="task-error"
          >
            <pre v-html="task.result.htmlError" />
          </div>
          <template v-else-if="task.result?.errors">
            <ViewReportError
              v-for="(error, idx) of task.result.errors"
              :key="idx"
              :error="error"
              :filename="file?.name"
              :root="config.root"
            />
          </template>
        </div>
      </div>
    </template>
    <template v-else>
      <div bg="green-500/10" text="green-500 sm" p="x4 y2" m-2 rounded>
        All tests passed in this file
      </div>
    </template>
    <template v-if="test.annotations.length">
      <h1 m-2>
        Test Annotations
      </h1>
      <div v-for="annotation of test.annotations" :key="annotation.type + annotation.message">
        <div
          bg="yellow-500/10"
          text="yellow-500 sm"
          p="x3 y2"
          m-2
          rounded
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
                v-if="annotation.location && annotation.location.file === file.filepath"
                v-tooltip.bottom="'Show in the editor'"
                title="Show in the editor"
                class="flex gap-1 text-yellow-500/80 cursor-pointer"
                ws-nowrap
                @click="openAnnotation(annotation)"
              >
                {{ getLocationString(annotation.location) }}
              </span>
              <span
                v-else-if="annotation.location && annotation.location.file !== file.filepath"
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
      </div>
    </template>
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
    <template v-if="browserState">
      <Modal v-model="showScreenshot" direction="right">
        <template v-if="currentTask">
          <Suspense>
            <ScreenshotError
              :file="currentTask.file.filepath"
              :name="currentTask.name"
              :url="currentScreenshotUrl"
              @close="showScreenshot = false"
            />
          </Suspense>
        </template>
      </Modal>
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
