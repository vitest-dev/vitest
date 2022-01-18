import { resolveConfig } from 'vite'
import type { VitePluginPWAAPI } from 'vite-plugin-pwa'
import { optimizePages } from './assets'

const rebuildPwa = async() => {
  const config = await resolveConfig({}, 'build', 'production')
  // when `vite-plugin-pwa` is presented, use it to regenerate SW after rendering
  const pwaPlugin: VitePluginPWAAPI = config.plugins.find(i => i.name === 'vite-plugin-pwa')?.api
  if (pwaPlugin && pwaPlugin.generateSW && !pwaPlugin.disabled) {
    await optimizePages()
    await pwaPlugin.generateSW()
  }
}

rebuildPwa()
