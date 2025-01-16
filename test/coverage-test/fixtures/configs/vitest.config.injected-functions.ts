import MagicString from 'magic-string'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'repro',
      transform(code, id, _options) {
        if (id.endsWith('injected-functions.ts')) {
          const output = new MagicString(code)
          output.prepend(`;function prepended(){};`)
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
