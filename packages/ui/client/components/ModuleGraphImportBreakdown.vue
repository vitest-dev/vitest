<script setup lang="ts">
import type { ModuleType } from '~/composables/module-graph'
import { relative } from 'pathe'
import { computed, ref } from 'vue'
import { config } from '~/composables/client'
import { currentModule } from '~/composables/navigation'
import { formatTime, getDurationClass, getExternalModuleName } from '~/utils/task'

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

    const raltiveModule = duration.external
      ? getExternalModuleName(filePath)
      : relative(root, filePath)
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

const imports = computed(() => sortedImports.value.slice(0, maxAmount.value + 1))

function ellipsisFile(moduleId: string) {
  if (moduleId.length <= 45) {
    return moduleId
  }
  return `...${moduleId.slice(-45)}`
}
</script>

<template>
  <div class="overflow-auto max-h-120">
    <h1 my-2 mx-4>
      Import Breakdown <span op-40>(ordered by Total Time) (Top {{ Math.min(maxAmount, imports.length) }})</span>
    </h1>
    <table my-2 mx-4 text-sm>
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
          <th>
            %
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
          <td pr-2 :class="row.selfTimeClass">
            {{ row.formattedSelfTime }}
          </td>
          <td pr-2 :class="row.totalTimeClass">
            {{ row.formattedTotalTime }}
          </td>
          <td pr-2 :class="row.totalTimeClass">
            {{ Math.round((row.totalTime / sortedImports[0].totalTime) * 100) }}%
          </td>
        </tr>
      </tbody>
    </table>
    <button
      v-if="maxAmount < sortedImports.length"
      class="flex w-full justify-center h-8 text-sm z-10 relative"
      @click="maxAmount += 5"
    >
      <!-- <button @click="maxAmount += 5"> -->
      Show more
      <!-- </button> -->
    </button>
  </div>
</template>
