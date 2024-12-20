export interface Params {
  file: string
  view: null | 'graph' | 'editor' | 'console'
  line: null | number
  test: null | string
}

export const params = useUrlSearchParams<Params>('hash', {
  initialValue: {
    file: '',
    view: null,
    line: null,
    test: null,
  },
})

export const activeFileId = toRef(params, 'file')
export const viewMode = toRef(params, 'view')
export const lineNumber = toRef(params, 'line')
export const selectedTest = toRef(params, 'test')
