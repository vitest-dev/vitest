import type { TestTagDefinition } from '@vitest/runner'
import type { TestError } from '@vitest/utils'
import type { Ref } from 'vue'
import type { RunState } from '../../../types'
import { computed, ref } from 'vue'
import { config } from '.'

export const testRunState: Ref<RunState> = ref('idle')
export const finished = computed(() => testRunState.value === 'idle')
export const unhandledErrors: Ref<TestError[]> = ref([])
export const tagsDefinitions = computed(() => {
  const tags = config.value.tags || []
  return tags.reduce((acc, tag) => {
    acc[tag.name] = tag
    return acc
  }, {} as Record<string, TestTagDefinition>)
})
