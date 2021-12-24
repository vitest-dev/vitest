<script setup lang="ts">
import { isDark, toggleDark } from '~/composables'
const tasks = shallowRef<
Array<{
  id: string
  name: string
  type: string
  mode: string
  result: {
    start: number
    state: string
    end: number
  }
}>
>([])

const setTasks = (ts: any[]) => tasks.value = ts

const onClickToggle = () => toggleDark()

</script>

<template>
  <nav
    bg-light-300
    dark:bg-dark-600
    w-72
    border-1
    border-rounded
    border-light-900
    dark:border-dark-200
    flex
    flex-col
  >
    <div
      grid="~ cols-[max-content,1fr,min-content]"
      gap-2
      items-center
      px-4
      h-14
      border-b-1
      border-light-900
      dark:border-dark-200
    >
      <img w-6 h-6 src="/favicon.svg">
      <span text-lg font-light>Vitest</span>
      <button
        text-xl
        text-dark-100
        dark:text-light-900
        :class="{
          'i-carbon-moon': isDark,
          'i-carbon-sun': !isDark
        }"
        @click="onClickToggle"
      />
    </div>
    <Files />
  </nav>
</template>
