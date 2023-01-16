import fs from 'fs'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import Components from 'unplugin-vue-components/vite'
import Unocss from 'unocss/vite'
import { presetAttributify, presetIcons, presetUno } from 'unocss'
import { resolve } from 'pathe'

export default defineConfig({
  optimizeDeps: {
    // vitepress is aliased with replacement `join(DIST_CLIENT_PATH, '/index')`
    // This needs to be excluded from optimization
    exclude: ['vitepress'],
  },
  plugins: [
    // TODO remove cast when moved to Vite 3
    Components({
      include: [/\.vue/, /\.md/],
      dirs: '.vitepress/components',
      dts: '.vitepress/components.d.ts',
    }) as Plugin,
    Unocss({
      shortcuts: [
        ['btn', 'px-4 py-1 rounded inline-flex justify-center gap-2 text-white leading-30px children:mya !no-underline cursor-pointer disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
      ],
      presets: [
        presetUno({
          dark: 'media',
        }),
        presetAttributify(),
        presetIcons({
          scale: 1.2,
        }),
      ],
    }) as unknown as Plugin,
    IncludesPlugin(),
  ],
})

function IncludesPlugin(): Plugin {
  return {
    name: 'include-plugin',
    enforce: 'pre',
    transform(code, id) {
      let changed = false
      code = code.replace(/\[@@include\]\((.*?)\)/, (_, url) => {
        changed = true
        const full = resolve(id, url)
        return fs.readFileSync(full, 'utf-8')
      })
      if (changed)
        return code
    },
  }
}
