import type { InitializeHook, ResolveHook } from 'node:module'
import type { MessagePort } from 'node:worker_threads'

let port: MessagePort

export const initialize: InitializeHook = async ({
  port: _port,
  time: _time,
}: {
  port: MessagePort
  time: string
}) => {
  port = _port
}

const NOW_LENGTH = Date.now().toString().length
const REGEXP_VITEST = new RegExp(`%3Fvitest=\\d{${NOW_LENGTH}}`)

export const resolve: ResolveHook = (specifier, context, defaultResolve) => {
  const isVitest = specifier.includes('%3Fvitest=')
  const result = defaultResolve(
    isVitest ? specifier.replace(REGEXP_VITEST, '') : specifier,
    context,
  )
  if (!port || !context?.parentURL) {
    return result
  }

  if (typeof result === 'object' && 'then' in result) {
    return result.then((resolved) => {
      ensureModuleGraphEntry(resolved.url, context.parentURL!)
      if (isVitest) {
        resolved.url = `${resolved.url}?vitest=${Date.now()}`
      }
      return resolved
    })
  }

  if (isVitest) {
    result.url = `${result.url}?vitest=${Date.now()}`
  }
  ensureModuleGraphEntry(result.url, context.parentURL)
  return result
}

function ensureModuleGraphEntry(url: string, parentURL: string) {
  if (url.includes('/node_modules/')) {
    return
  }
  port.postMessage({
    event: 'register-module-graph-entry',
    url,
    parentURL,
  })
}
