export interface Params {
  file: string
  view: null | 'graph' | 'editor' | 'console'
}

export const params = useUrlSearchParams<Params>('hash', {
  initialValue: {
    file: '',
    view: null,
  },
})

export const activeFileId = toRef(params, 'file')
export const viewMode = toRef(params, 'view')
