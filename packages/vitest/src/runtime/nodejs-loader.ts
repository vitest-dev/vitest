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
      if (!resolved.url.includes('node_modules')) {
        ensureModuleGraphEntry(resolved.url, context.parentURL!)
      }
      return resolved
    })
  }
  else if (!result.url.includes('node_modules')) {
    ensureModuleGraphEntry(result.url, context.parentURL)
  }
  return result
}

function ensureModuleGraphEntry(url: string, parentURL: string) {
  port.postMessage({
    event: 'register-module-graph-entry',
    url,
    parentURL,
  })
}
