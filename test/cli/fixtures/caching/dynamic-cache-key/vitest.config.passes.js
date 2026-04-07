import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'test:replacer',
      transform(code) {
        return code.replace('__REPLACED__', JSON.stringify(process.env.REPLACED))
      },
      configureVitest(ctx) {
        ctx.experimental_defineCacheKeyGenerator(() => {
          return String(process.env.REPLACED)
        })
      },
    },
  ],
})
