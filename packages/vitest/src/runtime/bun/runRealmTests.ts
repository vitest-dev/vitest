import { pathToFileURL } from 'node:url'
import { parse, resolve } from 'pathe'
import { stringify } from 'flatted'
import { distDir } from '../../paths'
import type { ShadowRealmContext } from '../../types'
import type { ShadowRealm, ShadowRealmOnCallback, ShadowRealmSendCallback } from './utils'

const entryUrl = pathToFileURL(resolve(distDir, 'entry-shadow-realm.js')).href

export async function runRealmTests(
  realm: ShadowRealm,
  ctx: ShadowRealmContext,
  send: ShadowRealmSendCallback,
  on: ShadowRealmOnCallback,
) {
  const run = await realm.importValue(entryUrl, 'run') as any
  await new Promise<void>((resolve, reject) => {
    run(
      stringify(ctx),
      send,
      on,
      () => resolve(),
      (error: string) => reject(parse(error)),
    )
  })
}
