import { toRef, useUrlSearchParams } from '@vueuse/core'

export interface Params {
  file: string
  view: null | 'graph' | 'editor' | 'console'
  line: null | number
  test: null | string
  column: null | number
  traceAttempt: null | string
  traceStep: null | number
}

const params = useUrlSearchParams<Params>('hash', {
  initialValue: {
    file: '',
    view: null,
    line: null,
    test: null,
    column: null,
    traceAttempt: null,
    traceStep: null,
  },
})

export const activeFileId = toRef(params, 'file')
export const viewMode = toRef(params, 'view')
export const lineNumber = toRef(params, 'line')
export const columnNumber = toRef(params, 'column')
export const selectedTest = toRef(params, 'test')
export const selectedTraceAttempt = toRef(params, 'traceAttempt')
export const selectedTraceStep = toRef(params, 'traceStep')
