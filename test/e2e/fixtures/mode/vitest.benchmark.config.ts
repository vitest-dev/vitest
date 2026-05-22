import { defineConfig } from 'vitest/config'

export default defineConfig((env) => {
  if (env.mode !== 'benchmark') {
    console.error('env.mode: ', env.mode)
    throw new Error('env.mode should be equal to "benchmark"')
  }

  return ({})
})
