import type { WorkerContext } from '../types'
import { setupInspect } from './inspector'
import { runRealmTests } from './bun/runRealmTests'
import { createShadowRealm } from './bun/utils'

export async function run(ctx: WorkerContext) {
  const inspectorCleanup = setupInspect(ctx.config)

  try {
    const realm = createShadowRealm()
    await runRealmTests(
      realm,
      ctx,
      message => ctx.port.postMessage(message),
      fn => ctx.port.addListener('message', fn),
    )
  }
  finally {
    inspectorCleanup()
  }
}
