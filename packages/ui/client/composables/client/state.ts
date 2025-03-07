import type { TestError } from '@vitest/utils'
import type { Ref } from 'vue'
import type { RunState } from '../../../types'

export const testRunState: Ref<RunState> = ref('idle')
export const finished = computed(() => testRunState.value === 'idle')
export const unhandledErrors: Ref<TestError[]> = ref([])
