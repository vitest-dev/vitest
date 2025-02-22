import { defineConfig } from 'vite'

const data: string[] = []

export default defineConfig({
  plugins: [
    {
      name: 'test-plugin',
      async buildStart() {
        data.push('buildStart:in')
        await new Promise(r => setTimeout(r, 100))
        data.push('buildStart:out')
      },
      transform(_code, id) {
        if (id.endsWith('/test.ts')) {
          console.log(JSON.stringify(data))
        }
      },
    },
  ],
})
