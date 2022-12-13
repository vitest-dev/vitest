<script lang="ts" src="./Counter.component.ts"></script>

<template>
  <button @click="count++">
    {{ count }}
  </button>

  <div v-if="count > 10">
    {{ uncoveredMethod() }}
  </div>
  <div v-else>
    {{ coveredMethod() }}
  </div>
</template>
