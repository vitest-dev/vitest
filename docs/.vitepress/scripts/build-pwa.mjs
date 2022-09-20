import { fileURLToPath } from 'url'
import { resolveConfig } from 'vite'
import jiti from 'jiti'

const rebuildPwa = async () => {
  const config = await resolveConfig({}, 'build', 'production')
  // when `vite-plugin-pwa` is presented, use it to regenerate SW after rendering
  const pwaPlugin = config.plugins.find(i => i.name === 'vite-plugin-pwa')?.api
  const pwa = pwaPlugin && !pwaPlugin.disabled
  const assets = jiti(fileURLToPath(import.meta.url))('./assets.ts')
  await assets.optimizePages(pwa)
  if (pwa)
    await pwaPlugin.generateSW()
}

rebuildPwa()
