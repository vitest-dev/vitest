<template>
  <div h-screen w-screen overflow="hidden">
    <Splitpanes class="default-theme">
      <Pane min-size="20">
        <Navigation />
      </Pane>
      <Pane min-size="20">
        <Suites />
      </Pane>
      <Pane min-size="20">
        <FileDetails />
      </Pane>
    </Splitpanes>
  </div>
  <ConnectionOverlay />
</template>

<script>
import { Pane, Splitpanes } from 'splitpanes'
export default {
  components: { Splitpanes, Pane },
}
</script>

<style>
:root {
  --color-splitpane-splitter: #F7F8F9;
  --color-splitpane-splitter-border: #E9EBED;
}

html.dark {
  --color-splitpane-splitter: #18191A;
  --color-splitpane-splitter-border: #212224;
}
.splitpanes__pane {
  background-color: unset !important;
}

.splitpanes__splitter {
  background-color: var(--color-splitpane-splitter) !important;
  border-left: 1px solid var(--color-splitpane-splitter-border) !important;
  border-right: 1px solid var(--color-splitpane-splitter-border);
}

.splitpanes__splitter::before,
.splitpanes__splitter::after {
  background-color: var(--color-text) !important;
  opacity: 0.5;
}
</style>
