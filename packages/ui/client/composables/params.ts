export interface Params {
  file: string
  view: null | 'graph' | 'editor' | 'console'
  isDescribeBlock: null | '0' | '1'
  testName: null | string
  testIndex: null | string
}

export const params = useUrlSearchParams<Params>('hash-params', {
  initialValue: {
    file: '',
    view: null,
    isDescribeBlock: null,
    testName: null,
    testIndex: null,
  },
})

export const activeFileId = toRef(params, 'file')
export const viewMode = toRef(params, 'view')
export const selectedTest = toRef(params, 'testName')
export const isDescribeBlock = toRef(params, 'isDescribeBlock')
export const testIndex = toRef(params, 'testIndex')
