import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    {
      name: 'repro',
      transform(code, id) {
        if (id.endsWith('/empty-mappings/main.ts')) {
          return { code, map: { mappings: '' } }
        }
      },
    },
  ],
})
