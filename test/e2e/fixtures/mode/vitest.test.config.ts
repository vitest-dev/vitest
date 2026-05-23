import { defineConfig } from 'vitest/config'

export default defineConfig((env) => {
  if (env.mode !== 'test') {
    console.error('env.mode: ', env.mode)
    throw new Error('env.mode should be equal to "test"')
  }

  return ({})
})
