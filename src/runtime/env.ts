import { setupChai } from '../integrations/chai/setup'
import { ResolvedConfig } from '../types'

export async function setupEnv(config: ResolvedConfig) {
  await setupChai(config)

  if (config.global)
    (await import('../integrations/global')).registerApiGlobally()

  if (config.dom === 'happy-dom')
    (await import('../integrations/dom/happy-dom')).setupHappyDOM(globalThis)
  else if (config.dom)
    (await import('../integrations/dom/jsdom')).setupJSDOM(globalThis)
}
