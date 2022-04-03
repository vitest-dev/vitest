import { globalApis } from '../constants'
import * as index from '../index'

export function registerApiGlobally() {
  globalApis.forEach((api) => {
    // @ts-expect-error I know what I am doing :P
    // eslint-disable-next-line import/namespace
    globalThis[api] = index[api]
  })
}
