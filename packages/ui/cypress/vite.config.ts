import { defineConfig } from 'vite'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { config } from '../vite.config'

config.plugins?.push(vueJsx())
config.server = { fs: { allow: ['../..'] } }

export default defineConfig(config)
