import type { ViteHotContext } from 'vite/types/hot.js'

const hot: ViteHotContext = import.meta.hot! || {
  on: warn,
  off: warn,
  send: warn,
}

function warn() {
  console.warn('Vitest mocker cannot work if Vite didn\'t establish WS connection.')
}

export { hot }

export function rpc<T>(event: string, data?: any): Promise<T> {
  hot.send(event, data)
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Failed to resolve ${event} in time`))
    }, 5_000)
    hot.on(`${event}:result`, function r(data) {
      resolve(data)
      clearTimeout(timeout)
      hot.off('vitest:mocks:resolvedId:result', r)
    })
  })
}
