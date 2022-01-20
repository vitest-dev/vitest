import { globalApis } from '../constants'
import * as index from '../index'

export function registerApiGlobally() {
  globalApis.forEach((api) => {
    // @ts-expect-error I know what I am doing :P
    globalThis[api] = index[api]
  })
}
