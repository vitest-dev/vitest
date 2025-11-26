<script setup lang="ts">
import type { ModuleType } from '~/composables/module-graph'
import { relative } from 'pathe'
import { computed, ref } from 'vue'
import { config } from '~/composables/client'
import { currentModule } from '~/composables/navigation'
import { formatTime, getExternalModuleName, getImportDurationType } from '~/utils/task'

interface ImportEntry {
  importedFile: string
  relativeFile: string
  selfTime: number
  totalTime: number
  formattedSelfTime: string
  formattedTotalTime: string
  selfTimeClass: string | undefined
  totalTimeClass: string | undefined
  external?: boolean
}

const emit = defineEmits<{
  select: [moduleId: string, type: ModuleType]
}>()

const maxAmount = ref(10)

const sortedImports = computed(() => {
  const file = currentModule.value
  const importDurations = file?.importDurations
  if (!importDurations) {
    return []
  }

  const root = config.value.root
  const allImports: ImportEntry[] = []
  for (const [filePath, duration] of Object.entries(importDurations)) {
    // ignore the test file because it will always be the biggest
    if (filePath === file.filepath) {
      continue
    }

    const raltiveModule = duration.external ? getExternalModuleName(filePath) : relative(root, filePath)
    // TODO: if starts with file://, remove the protocol
    allImports.push({
      importedFile: filePath,
      relativeFile: ellipsisFile(raltiveModule),
      selfTime: duration.selfTime,
      totalTime: duration.totalTime,
      formattedSelfTime: formatTime(duration.selfTime),
      formattedTotalTime: formatTime(duration.totalTime),
      selfTimeClass: getDurationClass(duration.selfTime),
      totalTimeClass: getDurationClass(duration.totalTime),
      external: duration.external,
    })
  }
  const sortedImports = allImports.sort((a, b) => b.totalTime - a.totalTime)
  return sortedImports
})

const imports = computed(() => sortedImports.value.slice(0, maxAmount.value))

function ellipsisFile(moduleId: string) {
  if (moduleId.length <= 45) {
    return moduleId
  }
  return `...${moduleId.slice(-45)}`
}

function getDurationClass(duration: number) {
  const type = getImportDurationType(duration)
  if (type === 'danger') {
    return 'text-red'
  }
  if (type === 'warning') {
    return 'text-orange'
  }
}
</script>

<template>
  <div class="overflow-auto max-h-120">
    <h1>Import Breakdown (ordered by Total Time) (Top {{ maxAmount }})</h1>
    <table text-sm>
      <thead>
        <tr>
          <th>
            Module
          </th>
          <th>
            Self
          </th>
          <th>
            Total
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row of imports" :key="row.importedFile">
          <td
            class="cursor-pointer pr-2"
            :style="{ color: row.external ? 'var(--color-node-external)' : undefined }"
            @click="emit('select', row.importedFile, row.external ? 'external' : 'inline')"
          >
            {{ row.relativeFile }}
          </td>
          <td class="pr-2" :class="row.selfTimeClass">
            {{ row.formattedSelfTime }}
          </td>
          <td :class="row.totalTimeClass">
            {{ row.formattedTotalTime }}
          </td>
        </tr>
      </tbody>
    </table>
    <!-- TODO: design -->
    <button v-if="maxAmount < sortedImports.length" @click="maxAmount += 5">
      more
    </button>
  </div>
</template>
