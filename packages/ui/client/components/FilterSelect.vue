<script setup lang="ts">
defineProps<{ options: string[] }>()
const emit = defineEmits(['update'])

const selected = ref('All')

function onChange() {
  emit('update', selected.value)
}
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
