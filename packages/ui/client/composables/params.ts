import { toRef, useUrlSearchParams } from '@vueuse/core'

export interface Params {
  'trace-attempt': null | string
  'file': string
  'view': null | 'graph' | 'editor' | 'console'
  'line': null | number
  'trace-step': null | number
  'test': null | string
  'column': null | number
}

const params = useUrlSearchParams<Params>('hash', {
  initialValue: {
    'trace-attempt': null,
    'file': '',
    'view': null,
    'line': null,
    'trace-step': null,
    'test': null,
    'column': null,
  },
})

export const activeFileId = toRef(params, 'file')
export const viewMode = toRef(params, 'view')
export const lineNumber = toRef(params, 'line')
export const columnNumber = toRef(params, 'column')
export const selectedTest = toRef(params, 'test')
export const selectedTraceAttempt = toRef(params, 'trace-attempt')
export const selectedTraceStep = toRef(params, 'trace-step')
