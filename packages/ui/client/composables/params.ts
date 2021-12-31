export interface Params {
  file: string
  view: null | 'graph' | 'editor'
}

export const params = useUrlSearchParams<Params>('hash-params', {
  initialValue: {
    file: '',
    view: null,
  },
})

export const activeFileId = toRef(params, 'file')
export const viewMode = toRef(params, 'view')
