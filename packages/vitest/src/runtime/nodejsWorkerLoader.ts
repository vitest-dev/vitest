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

export const resolve: ResolveHook = (specifier, context, defaultResolve) => {
  const result = defaultResolve(specifier, context)
  if (!port || !context?.parentURL) {
    return result
  }

  if (typeof result === 'object' && 'then' in result) {
    return result.then((resolved) => {
      ensureModuleGraphEntry(resolved.url, context.parentURL!)
      return resolved
    })
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
