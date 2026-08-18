import { toRef, useUrlSearchParams } from '@vueuse/core'

export interface Params {
  attempt: null | string
  file: string
  view: null | 'graph' | 'editor' | 'console'
  line: null | number
  step: null | number
  test: null | string
  column: null | number
}

export const params = useUrlSearchParams<Params>('hash', {
  initialValue: {
    attempt: null,
    file: '',
    view: null,
    line: null,
    step: null,
    test: null,
    column: null,
  },
})

export const activeFileId = toRef(params, 'file')
export const viewMode = toRef(params, 'view')
export const lineNumber = toRef(params, 'line')
export const columnNumber = toRef(params, 'column')
export const selectedTest = toRef(params, 'test')
export const selectedTraceAttempt = toRef(params, 'attempt')
export const selectedTraceStep = toRef(params, 'step')
