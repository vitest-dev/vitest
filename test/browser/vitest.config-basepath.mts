import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config.mts'

export default mergeConfig(baseConfig, defineConfig({ base: '/fix-4686' }))
