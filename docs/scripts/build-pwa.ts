import { resolveConfig } from 'vite'
import type { VitePluginPWAAPI } from 'vite-plugin-pwa'
import { optimizePages } from './assets'

const rebuildPwa = async() => {
  const config = await resolveConfig({}, 'build', 'production')
  // when `vite-plugin-pwa` is presented, use it to regenerate SW after rendering
  const pwaPlugin: VitePluginPWAAPI = config.plugins.find(i => i.name === 'vite-plugin-pwa')?.api
  const pwa = pwaPlugin && !pwaPlugin.disabled
  await optimizePages(pwa)
  if (pwa)
    await pwaPlugin.generateSW()
}

rebuildPwa()
