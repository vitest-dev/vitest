import { globalApis } from './constants'
import * as index from './index'

export function registerApiGlobally() {
  globalApis.forEach((api) => {
    // @ts-expect-error
    globalThis[api] = index[api]
  })
}
