import {
  defineConfig,
  minimalPreset as preset,
} from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...preset,
    assetName(type, size) {
      switch (type) {
        case 'transparent':
          return `pwa-${size.width}x${size.height}.png`
        case 'maskable':
          return 'maskable-icon.png'
        case 'apple':
          return 'apple-touch-icon.png'
      }
    },
  },
  images: ['public/logo.svg'],
})
