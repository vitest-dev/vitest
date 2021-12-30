<template>
  <div grid="~ cols-[10rem_auto]" h-screen w-screen overflow="hidden">
    <div border="r base">
      <div
        p="2"
        h-10
        flex="~ gap-2"
        items-center
        bg-header
        border="b base"
      >
        <span
          font-light
          text-sm
          flex-auto
          ws-nowrap
          overflow-hidden
          truncate
        >
          Settings
        </span>
        <IconButton
          icon="i-carbon-reset"
          :onclick="resetGraphController"
        />
      </div>
      <div class="graph-settings">
        <div
          p="2"
          h-10
          flex="~ gap-2"
        >
          <span
            font-light
            flex-auto
            text-sm
            ws-nowrap
            truncate
          >
            Modules
          </span>
        </div>
        <div
          v-for="type of controller?.nodeTypes.sort()"
          :key="type"
          px-2
          py-1
          class="type-checkbox"
        >
          <input
            :id="`type-${type}`"
            type="checkbox"
            :checked="controller?.nodeTypeFilter.includes(type)"
            @change="
              controller?.filterNodesByType($event.currentTarget.checked, type)
            "
          >
          <label
            font-light
            text-sm
            ws-nowrap
            overflow-hidden
            truncate :for="`type-${type}`"
            style="text-transform: capitalize"
          >
            {{ type }}
          </label>
          <div class="type-circle" :style="{ 'background-color': `var(--color-node-${type})`}" />
        </div>
      </div>
    </div>
    <div ref="graph" class="graph" />
  </div>
</template>

<script lang="ts">
import { GraphController } from 'd3-graph-controller'
import type { PropType } from 'vue'
import { defineComponent } from 'vue'
import type { ModuleGraph, ModuleGraphConfig, ModuleGraphController } from '~/composables/module-graph'

function debounce(cb: () => void) {
  let h = 0
  return () => {
    window.clearTimeout(h)
    h = window.setTimeout(() => cb())
  }
}

export default defineComponent({
  props: {
    config: {
      type: Object as PropType<ModuleGraphConfig>,
      required: true,
    },
    graph: {
      type: Object as PropType<ModuleGraph>,
      required: true,
    },
  },
  data() {
    return {
      controller: undefined as ModuleGraphController | undefined,
    }
  },
  computed: {
    resizeObserver(): ResizeObserver {
      return new ResizeObserver(debounce(() => this.controller?.resize()))
    },
    container(): HTMLDivElement {
      return this.$refs.graph as HTMLDivElement
    },
  },
  watch: {
    config() {
      this.resetGraphController()
    },
    graph() {
      this.resetGraphController()
    },
  },
  mounted() {
    this.resetGraphController()
    this.resizeObserver.observe(this.container)
  },
  beforeUnmount() {
    this.resizeObserver.unobserve(this.container)
    this.controller?.shutdown()
  },
  methods: {
    resetGraphController(): void {
      this.controller?.shutdown()
      this.controller = new GraphController(
        this.container,
        this.graph,
        this.config,
      )
    },
  },
})
</script>

<style scoped>
.graph-settings {
  display: flex;
  flex-direction: column;
}

.graph-settings > div {
  width: 100%;
}

.type-checkbox {
  align-items: center;
  display: flex;
  gap: 0.25em;
}

.type-circle {
  display: inline;
  border-radius: 50%;
  width: 0.75rem;
  height: 0.75rem;
}
</style>

<style>
:root {
  --color-link-label: var(--color-text);
  --color-link: var(--color-text);
  --color-node-external: #FCC72B;
  --color-node-inline: #22C55E;
  --color-node-label: var(--color-text-light);
  --color-node-stroke: var(--color-text);
}

.graph .node {
  stroke-width: 4px;
}
</style>
