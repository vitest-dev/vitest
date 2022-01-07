<script setup lang="ts">
// @ts-expect-error missing types
import { Pane, Splitpanes } from 'splitpanes'

const sizes = reactive([33, 33, 34])

function onResize(event: { size: number }[]) {
  event.forEach((e, i) => {
    sizes[i] = e.size
  })
}

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
    <Splitpanes @resize="onResize">
      <Pane :size="sizes[0]">
        <Navigation />
      </Pane>
      <Pane :size="sizes[1]">
        <Suites />
      </Pane>
      <Pane :size="sizes[2]">
        <FileDetails />
      </Pane>
    </Splitpanes>
  </div>
  <ConnectionOverlay />
</template>
