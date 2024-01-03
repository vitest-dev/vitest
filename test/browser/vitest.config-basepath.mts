import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config.mjs'

export default mergeConfig(baseConfig, defineConfig({ base: '/fix-4686' }))
