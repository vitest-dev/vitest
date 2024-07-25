import { globalApis } from '../constants'
import * as index from '../public/index'

export function registerApiGlobally() {
  globalApis.forEach((api) => {
    // @ts-expect-error I know what I am doing :P
    globalThis[api] = index[api]
  })
}
