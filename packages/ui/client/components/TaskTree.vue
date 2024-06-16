<script setup lang="ts">
import type { Task } from "vitest";
import { nextTick } from "vue";
import { runFiles, client } from "~/composables/client";
import { caseInsensitiveMatch } from "~/utils/task";
import { openedTreeItems, coverageEnabled } from "~/composables/navigation";

defineOptions({ inheritAttrs: false });

// TODO: better handling of "opened" - it means to forcefully open the tree item and set in TasksList right now
const {
  task,
  indent = 0,
  nested = false,
  search,
  onItemClick,
  opened = false,
} = defineProps<{
  task: Task;
  failedSnapshot: boolean;
  indent?: number;
  opened?: boolean;
  nested?: boolean;
  search?: string;
  onItemClick?: (task: Task) => void;
}>();

const isOpened = computed(
  () => opened || openedTreeItems.value.includes(task.id)
);

function toggleOpen() {
  if (isOpened.value) {
    const tasksIds = "tasks" in task ? task.tasks.map((t) => t.id) : [];
    openedTreeItems.value = openedTreeItems.value.filter(
      (id) => id !== task.id && !tasksIds.includes(id)
    );
  } else {
    openedTreeItems.value = [...openedTreeItems.value, task.id];
  }
}

async function onRun() {
  onItemClick?.(task);
  if (coverageEnabled.value) {
    disableCoverage.value = true;
    await nextTick();
  }
  await runFiles([task.file]);
}

function updateSnapshot() {
  return client.rpc.updateSnapshot(task);
}
</script>

<template>
  <!-- maybe provide a KEEP STRUCTURE mode, do not filter by search keyword  -->
  <!-- v-if = keepStructure ||  (!search || caseInsensitiveMatch(task.name, search)) -->
  <TaskItem
    v-if="
      opened || !nested || !search || caseInsensitiveMatch(task.name, search)
    "
    v-bind="$attrs"
    :task="task"
    :style="{
      paddingLeft: indent
        ? `${indent * 0.75 + (task.type === 'suite' ? 0.5 : 1.75)}rem`
        : '1rem',
    }"
    :opened="isOpened && task.type === 'suite' && task.tasks.length"
    :failed-snapshot="failedSnapshot"
    @click="toggleOpen()"
    @run="onRun()"
    @fix-snapshot="updateSnapshot()"
    @preview="onItemClick?.(task)"
  />
  <div
    v-if="nested && task.type === 'suite' && task.tasks.length"
    v-show="isOpened"
  >
    <TaskTree
      v-for="suite in task.tasks"
      :key="suite.id"
      :failed-snapshot="false"
      :task="suite"
      :nested="nested"
      :indent="indent + 1"
      :search="search"
      :on-item-click="onItemClick"
    />
  </div>
</template>
