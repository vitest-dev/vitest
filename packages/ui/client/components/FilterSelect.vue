<script lang="ts">
import type { PropType } from 'vue'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'FilterSelect',
  props: {
    options: {
      type: Array as PropType<string[]>,
      required: true,
    },
  },
  data() {
    return {
      selected: 'All',
    }
  },
  methods: {
    onChange() {
      this.$emit('update', this.selected)
    },
  },
})
</script>

<template>
  <div>
    <label for="select">Projects</label>
    <select id="select" v-model="selected" @change="onChange">
      <option value="All">
        All
      </option>
      <option v-for="(option, index) in options" :key="index" :value="option">
        {{ option }}
      </option>
    </select>
  </div>
</template>

<style scoped>
label {
    margin-top: 10px;
    font-size: 14px;
    margin-bottom: 8px;
    display: block;
}
select {
    padding: 6px;
    width: 150%;
    font-size: 12px;
    border-radius: 4px;
    border: 1px solid #ccc;
}
</style>
