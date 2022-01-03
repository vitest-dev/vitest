<script lang="ts">
import { defineComponent } from '@vue/composition-api'

export default defineComponent({
  props: {
    count: {
      type: Number,
      required: true,
    },
  },
  data: () => ({
    times: 2,
  }),
  computed: {
    result(): number {
      return this.count * this.times
    },
  },
})
</script>

<template>
  <div>
    <div>{{ count }} x {{ times }} = {{ result }}</div>
    <button @click="times += 1">
      x1
    </button>
  </div>
</template>
