<script setup lang="ts">
// @ts-expect-error missing types
import { Pane, Splitpanes } from 'splitpanes'
import { initializeNavigation } from '../composables/navigation'

const summaryVisible = initializeNavigation()
const sizes = reactive([33, 33, 34])
const summarySize = ref(sizes[1] + sizes[2])

watch(() => sizes[0], (s) => {
  summarySize.value = 100 - s
}, { immediate: true })

const onResized = useDebounceFn((event: { size: number }[]) => {
  if (event.length === 2) {
    sizes[0] = event[0].size
  }
  else {
    event.forEach((e, i) => {
      sizes[i] = e.size
    })
  }
}, 0)

onMounted(() => {
  const width = window.innerWidth
  const panelWidth = Math.min(width / 3, 300)
  const panelPercent = panelWidth / width * 100
  sizes[0] = panelPercent
  sizes[1] = panelPercent
  sizes[2] = 100 - panelPercent * 2
})
</script>

<template>
  <div h-screen w-screen overflow="hidden">
    <Splitpanes @resized="onResized">
      <Pane :size="sizes[0]">
        <Navigation />
      </Pane>
      <Pane v-if="summaryVisible" :size="summarySize">
        <ReportSummary />
      </Pane>
      <Pane v-if="!summaryVisible" key="suites" :size="sizes[1]">
        <Suites />
      </Pane>
      <Pane v-if="!summaryVisible" key="file-details" :size="sizes[2]">
        <FileDetails />
      </Pane>
    </Splitpanes>
  </div>
  <ConnectionOverlay />
</template>
