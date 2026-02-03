<script setup lang="ts">
import type { ModuleType } from '~/composables/module-graph'
import { relative } from 'pathe'
import { computed } from 'vue'
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

const imports = computed(() => {
  const file = currentModule.value
  const importDurations = file?.importDurations
  const root = config.value.root
  if (!importDurations || !root) {
    return []
  }

  const allImports: ImportEntry[] = []
  for (const filePath in importDurations) {
    const duration = importDurations[filePath]
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
  return allImports.sort((a, b) => b.totalTime - a.totalTime)
})

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
      Import Duration Breakdown <span op-70>(ordered by Total Time)</span>
    </h1>
    <table my-2 mx-4 text-sm font-light op-90>
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
            {{ Math.round((row.totalTime / imports[0].totalTime) * 100) }}%
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
