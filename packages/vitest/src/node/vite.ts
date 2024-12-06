import type { InlineConfig } from 'vite'
import { createServer } from 'vite'

export async function createViteServer(inlineConfig: InlineConfig) {
  // Vite prints an error (https://github.com/vitejs/vite/issues/14328)
  // But Vitest works correctly either way
  const error = console.error
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string'
      && args[0].includes('WebSocket server error:')
    ) {
      return
    }
    error(...args)
  }

  const server = await createServer(inlineConfig)

  console.error = error
  return server
}
