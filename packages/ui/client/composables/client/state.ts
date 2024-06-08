import type { Ref } from 'vue'
import type { ErrorWithDiff } from '@vitest/utils'
import type { RunState } from '../../../types'
import type { UIFile } from '~/composables/client/types'

export const testRunState: Ref<RunState> = ref('idle')
export const files = shallowRef<UIFile[]>([])
export const finished = computed(() => testRunState.value === 'idle')
export const unhandledErrors: Ref<ErrorWithDiff[]> = ref([])
