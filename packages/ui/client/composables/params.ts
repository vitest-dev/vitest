export interface Params {
  file: string
  view: null | 'graph' | 'editor' | 'console'
  line: null | number
  test: null | string
  column: null | number
}

export const params = useUrlSearchParams<Params>('hash', {
  initialValue: {
    file: '',
    view: null,
    line: null,
    test: null,
    column: null,
  },
})

export const activeFileId = toRef(params, 'file')
export const viewMode = toRef(params, 'view')
export const lineNumber = toRef(params, 'line')
export const columnNumber = toRef(params, 'column')
export const selectedTest = toRef(params, 'test')
