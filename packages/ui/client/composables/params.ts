export interface Params {
  file: string
  view: null | 'graph' | 'editor' | 'console'
  line: null | number
}

export const params = useUrlSearchParams<Params>('hash', {
  initialValue: {
    file: '',
    view: null,
    line: null,
  },
})

export const activeFileId = toRef(params, 'file')
export const viewMode = toRef(params, 'view')
export const lineNumber = toRef(params, 'line')
