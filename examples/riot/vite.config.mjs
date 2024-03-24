import { defineConfig } from 'vite'
import riot from 'rollup-plugin-riot'

export default defineConfig({
  plugins    : [riot()],
  build: { 
    minify       : 'esbuild',
    target       : 'esnext'
  },
  test: {
    environment: 'jsdom'
  }
})
