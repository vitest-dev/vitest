<script setup lang="ts">
import type { Task } from "vitest";
import { getProjectNameColor } from "~/utils/task";
import { activeFileId } from "~/composables/params";
import { isReport } from "~/constants";

const props = defineProps<{
  task: Task;
  opened: boolean;
  failedSnapshot: boolean;
}>();

const emit = defineEmits<{
  run: [];
  preview: [];
  fixSnapshot: [];
}>();

const duration = computed(() => {
  const { result } = props.task;
  return result && Math.round(result.duration || 0);
});
</script>

<template>
  <div
    v-if="task"
    flex="~ row"
    items-center
    p="x-2 y-1"
    border-rounded
    cursor-pointer
    hover="bg-active"
    class="item-wrapper"
    :aria-label="task.name"
    :data-current="activeFileId === task.id"
  >
    <div v-if="task.type === 'suite'" pr-1>
      <div v-if="opened" i-carbon-chevron-down op20 />
      <div v-else i-carbon-chevron-right op20 />
    </div>
    <StatusIcon :task="task" mr-2 />
    <div
      v-if="task.type === 'suite' && task.meta.typecheck"
      i-logos:typescript-icon
      flex-shrink-0
      mr-2
    />
    <div
      flex
      items-end
      gap-2
      :text="task?.result?.state === 'fail' ? 'red-500' : ''"
      overflow-hidden
    >
      <span text-sm truncate font-light>
        <!-- only show [] in files view -->
        <span
          v-if="'filepath' in task && task.projectName"
          :style="{ color: getProjectNameColor(task.file.projectName) }"
        >
          [{{ task.file.projectName }}]
        </span>
        {{ task.name }}
      </span>
      <span
        v-if="typeof duration === 'number'"
        text="xs"
        op20
        style="white-space: nowrap"
      >
        {{ duration > 0 ? duration : "< 1" }}ms
      </span>
    </div>
    <div
      v-if="task.type === 'suite' && 'filepath' in task"
      gap-1
      justify-end
      flex-grow-1
      pl-1
      class="test-actions"
    >
      <IconAction
        v-if="!isReport && failedSnapshot"
        v-tooltip.bottom="'Fix failed snapshot(s)'"
        data-testid="btn-fix-snapshot"
        title="Fix failed snapshot(s)"
        icon="i-carbon-result-old"
        @click.prevent.stop="emit('fixSnapshot')"
      />
      <IconAction
        v-tooltip.bottom="'Open test details'"
        data-testid="btn-open-details"
        title="Open test details"
        icon="i-carbon-intrusion-prevention"
        @click.prevent.stop="emit('preview')"
      />
      <IconAction
        v-if="!isReport"
        v-tooltip.bottom="'Run current test'"
        data-testid="btn-run-test"
        title="Run current test"
        icon="i-carbon:play-filled-alt"
        text-green5
        @click.prevent.stop="emit('run')"
      />
    </div>
  </div>
</template>

<style scoped>
.test-actions {
  display: none;
}

.item-wrapper:hover .test-actions,
.item-wrapper[data-current="true"] .test-actions {
  display: flex;
}
</style>
