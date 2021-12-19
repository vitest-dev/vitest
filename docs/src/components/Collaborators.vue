<script setup lang="ts">
import collaborators from '../collaborators.json'
</script>

<template>
  <div flex="~ wrap gap-5" justify-center p-5>
    <CollaboratorAvatar v-for="c in collaborators" :key="c.login" :login="c.login" :name="c.name" :avatar="c.avatarUrl" />
  </div>
</template>
