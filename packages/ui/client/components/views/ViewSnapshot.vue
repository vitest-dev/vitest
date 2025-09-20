<script setup lang="ts">
import type { RunnerTestFile } from 'vitest'
import { client } from '~/composables/client'

interface SnapshotData {
  filepath: string
  snapshots: {
    added: Array<{
      name: string
      content: string
      testName?: string
    }>
    matched: Array<{
      name: string
      content: string
      testName?: string
    }>
    unmatched: Array<{
      name: string
      content: string
      testName?: string
    }>
    unchecked: Array<{
      name: string
      content: string
      testName?: string
    }>
  }
}

const props = defineProps<{
  file: RunnerTestFile
}>()

const snapshotData = ref<SnapshotData | void>()
const loading = ref(false)
const error = ref<string | null>(null)

async function loadSnapshot() {
  if (!props.file?.filepath) {
    return
  }
  loading.value = true
  error.value = null

  try {
    const data = await client.rpc.getSnapshotData?.(props.file.filepath)
    snapshotData.value = data
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load snapshot data'
  }
  finally {
    loading.value = false
  }
}

// Copy to clipboard function
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  }
  catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }
}

// Load snapshot when file changes
watch(() => props.file?.filepath, loadSnapshot, { immediate: true })
</script>

<template>
  <div class="h-full flex flex-col">
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-secondary">
        Loading snapshots...
      </div>
    </div>

    <div v-else-if="error" class="flex-1 flex items-center justify-center flex-col gap-2">
      <div class="text-red-500">
        {{ error }}
      </div>
      <button class="text-primary underline" @click="loadSnapshot">
        Try again
      </button>
    </div>

    <div v-else-if="!snapshotData" class="flex-1 flex items-center justify-center">
      <div class="text-secondary">
        No snapshots found for this test file
      </div>
    </div>

    <div
      v-else-if="!snapshotData.snapshots.added.length
        && !snapshotData.snapshots.matched.length
        && !snapshotData.snapshots.unmatched.length
        && !snapshotData.snapshots.unchecked.length"
      class="flex-1 flex items-center justify-center"
    >
      <div class="text-secondary">
        Snapshot file found but no snapshots exist
      </div>
    </div>

    <div v-else class="flex-1 overflow-auto p-4 space-y-6">
      <div class="text-xs text-secondary opacity-70 font-mono mb-4">
        {{ snapshotData.filepath }}
      </div>

      <!-- Added Snapshots -->
      <div v-if="snapshotData.snapshots.added.length > 0" class="space-y-2">
        <details class="group" open>
          <summary class="cursor-pointer p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300 font-medium text-sm">
            🆕 Added Snapshots ({{ snapshotData.snapshots.added.length }})
          </summary>
          <div class="mt-2 space-y-3">
            <div v-for="(snapshot) in snapshotData.snapshots.added" :key="snapshot.name" class="bg-header rounded border border-green-200 dark:border-green-800">
              <div class="p-3 border-b border-base flex items-center justify-between">
                <div>
                  <h3 class="font-mono text-sm text-primary font-medium">
                    {{ snapshot.name }}
                  </h3>
                  <div v-if="snapshot.testName && snapshot.testName !== snapshot.name" class="text-xs text-secondary mt-1">
                    Test: {{ snapshot.testName }}
                  </div>
                </div>
                <span class="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900 px-2 py-1 rounded">Added</span>
              </div>
              <div class="relative">
                <pre class="p-4 text-sm overflow-auto whitespace-pre-wrap font-mono bg-code text-code max-h-96">{{ snapshot.content }}</pre>
                <button
                  class="absolute top-2 right-2 text-xs px-2 py-1 bg-primary text-primary-foreground rounded opacity-70 hover:opacity-100 transition-opacity"
                  title="Copy snapshot content"
                  @click="copyToClipboard(snapshot.content)"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </details>
      </div>

      <!-- Matched Snapshots -->
      <div v-if="snapshotData.snapshots.matched.length > 0" class="space-y-2">
        <details class="group">
          <summary class="cursor-pointer p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300 font-medium text-sm">
            ✅ Matched Snapshots ({{ snapshotData.snapshots.matched.length }})
          </summary>
          <div class="mt-2 space-y-3">
            <div v-for="(snapshot) in snapshotData.snapshots.matched" :key="snapshot.name" class="bg-header rounded border border-green-200 dark:border-green-800">
              <div class="p-3 border-b border-base flex items-center justify-between">
                <div>
                  <h3 class="font-mono text-sm text-primary font-medium">
                    {{ snapshot.name }}
                  </h3>
                  <div v-if="snapshot.testName && snapshot.testName !== snapshot.name" class="text-xs text-secondary mt-1">
                    Test: {{ snapshot.testName }}
                  </div>
                </div>
                <span class="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900 px-2 py-1 rounded">Matched</span>
              </div>
              <div class="relative">
                <pre class="p-4 text-sm overflow-auto whitespace-pre-wrap font-mono bg-code text-code max-h-96">{{ snapshot.content }}</pre>
                <button
                  class="absolute top-2 right-2 text-xs px-2 py-1 bg-primary text-primary-foreground rounded opacity-70 hover:opacity-100 transition-opacity"
                  title="Copy snapshot content"
                  @click="copyToClipboard(snapshot.content)"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </details>
      </div>

      <!-- Unmatched Snapshots -->
      <div v-if="snapshotData.snapshots.unmatched.length > 0" class="space-y-2">
        <details class="group" open>
          <summary class="cursor-pointer p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 font-medium text-sm">
            ❌ Unmatched Snapshots ({{ snapshotData.snapshots.unmatched.length }})
          </summary>
          <div class="mt-2 space-y-3">
            <div v-for="(snapshot) in snapshotData.snapshots.unmatched" :key="snapshot.name" class="bg-header rounded border border-red-200 dark:border-red-800">
              <div class="p-3 border-b border-base flex items-center justify-between">
                <div>
                  <h3 class="font-mono text-sm text-primary font-medium">
                    {{ snapshot.name }}
                  </h3>
                  <div v-if="snapshot.testName && snapshot.testName !== snapshot.name" class="text-xs text-secondary mt-1">
                    Test: {{ snapshot.testName }}
                  </div>
                </div>
                <span class="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 px-2 py-1 rounded">Unmatched</span>
              </div>
              <div class="relative">
                <pre class="p-4 text-sm overflow-auto whitespace-pre-wrap font-mono bg-code text-code max-h-96">{{ snapshot.content }}</pre>
                <button
                  class="absolute top-2 right-2 text-xs px-2 py-1 bg-primary text-primary-foreground rounded opacity-70 hover:opacity-100 transition-opacity"
                  title="Copy snapshot content"
                  @click="copyToClipboard(snapshot.content)"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </details>
      </div>

      <!-- Unchecked Snapshots -->
      <div v-if="snapshotData.snapshots.unchecked.length > 0" class="space-y-2">
        <details class="group" open>
          <summary class="cursor-pointer p-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded text-yellow-700 dark:text-yellow-300 font-medium text-sm">
            ⚠️ Unchecked Snapshots ({{ snapshotData.snapshots.unchecked.length }})
          </summary>
          <div class="mt-2 space-y-3">
            <div v-for="(snapshot) in snapshotData.snapshots.unchecked" :key="snapshot.name" class="bg-header rounded border border-yellow-200 dark:border-yellow-800">
              <div class="p-3 border-b border-base flex items-center justify-between">
                <div>
                  <h3 class="font-mono text-sm text-primary font-medium">
                    {{ snapshot.name }}
                  </h3>
                  <div v-if="snapshot.testName && snapshot.testName !== snapshot.name" class="text-xs text-secondary mt-1">
                    Test: {{ snapshot.testName }}
                  </div>
                </div>
                <span class="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded">Unchecked</span>
              </div>
              <div class="relative">
                <pre class="p-4 text-sm overflow-auto whitespace-pre-wrap font-mono bg-code text-code max-h-96">{{ snapshot.content }}</pre>
                <button
                  class="absolute top-2 right-2 text-xs px-2 py-1 bg-primary text-primary-foreground rounded opacity-70 hover:opacity-100 transition-opacity"
                  title="Copy snapshot content"
                  @click="copyToClipboard(snapshot.content)"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-code {
  background-color: var(--c-bg-code, #f5f5f5);
}

.text-code {
  color: var(--c-text-code, #2d3748);
}

[data-theme="dark"] .bg-code {
  background-color: var(--c-bg-code, #1a1a1a);
}

[data-theme="dark"] .text-code {
  color: var(--c-text-code, #e2e8f0);
}

details summary::-webkit-details-marker {
  display: none;
}

details summary::before {
  content: '▶';
  margin-right: 8px;
  transition: transform 0.2s;
}

details[open] summary::before {
  transform: rotate(90deg);
}
</style>
