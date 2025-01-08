import MagicString from 'magic-string'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      reporter: ['text', 'text-summary', 'html', 'clover', 'json'],
    },
  },
  plugins: [
    {
      name: 'repro',
      transform(code, id, _options) {
        if (id.endsWith('/basic.ts')) {
          const output = new MagicString(code)
          output.prepend(`function prepended(){};`)
          output.append(`;function appended(){};`)
          return {
            code: output.toString(),
            map: output.generateMap({ hires: 'boundary' }),
          }
        }
      },
    },
  ],
})
