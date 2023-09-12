import { pathToFileURL, resolve } from 'node:url'
import { parse, stringify } from 'flatted'
import { createDefer } from '@vitest/utils'
import type { WorkerContext } from '../types'
import { distDir } from '../paths'
import { setupInspect } from './inspector'

declare class ShadowRealm {
  constructor()
  importValue(specifier: string, bindingName: string): Promise<unknown>
  evaluate(sourceText: string): unknown
}

const entryUrl = pathToFileURL(resolve(distDir, 'entry-shadow-realm.js')).href

export async function run(ctx: WorkerContext) {
  const inspectorCleanup = setupInspect(ctx.config)

  try {
    const realm = new ShadowRealm()
    const promise = createDefer<void>()
    const run = await realm.importValue(entryUrl, 'run') as any
    run(
      stringify(ctx),
      (message: string) => ctx.port.postMessage(message),
      (fn: () => void) => ctx.port.addListener('message', fn),
      () => promise.resolve(),
      (error: string) => promise.reject(parse(error)),
    )
    await promise
  }
  finally {
    inspectorCleanup()
  }
}
