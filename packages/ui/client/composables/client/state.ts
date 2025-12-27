import type { TestError } from '@vitest/utils'
import type { Ref } from 'vue'
import type { RunState } from '../../../types'
import { computed, ref } from 'vue'

export const testRunState: Ref<RunState> = ref('idle')
export const finished = computed(() => testRunState.value === 'idle')
export const unhandledErrors: Ref<TestError[]> = ref([])
