import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Plugin, defineConfig, mergeConfig } from 'vitest/config'
import { transformWithEsbuild } from 'vite'

import base from './vitest.config'

export default mergeConfig(
  base,
  defineConfig({
    plugins: [VirtualFilesPlugin()],
    test: {}
  })
)

// Simulates Vite's virtual files: https://vitejs.dev/guide/api-plugin.html#virtual-modules-convention
function VirtualFilesPlugin(): Plugin {
  return {
    name: 'vitest-custom-virtual-files',
    resolveId(id) {
      if (id === 'virtual:vitest-custom-virtual-file-1') {
        return 'src/virtual:vitest-custom-virtual-file-1.ts'
      }

      if (id === '\0vitest-custom-virtual-file-2') {
        return 'src/\0vitest-custom-virtual-file-2.ts'
      }

      if (id.includes('vitest-custom-virtual:math')) {
        return resolve(import.meta.dirname, "../src/vitest-custom-virtual:math")
      }
    },
    load(id) {
      if (id === 'src/virtual:vitest-custom-virtual-file-1.ts') {
        return `
          const virtualFile = "This file should be excluded from coverage report #1"
          export default virtualFile;
        `
      }

      // Vitest browser resolves this as "\x00", Node as "__x00__"
      if (id === 'src/__x00__vitest-custom-virtual-file-2.ts' || id === 'src/\x00vitest-custom-virtual-file-2.ts') {
        return `
          const virtualFile = "This file should be excluded from coverage report #2"
          export default virtualFile;
        `
      }

      if(id.includes("vitest-custom-virtual:math")) {
        const filename = resolve(import.meta.dirname, "../src/math.ts");
        const sources = readFileSync(filename, "utf8")

        return transformWithEsbuild(sources, filename)
      }
    },
  }
}
