import { defineConfig } from 'vite'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { config } from '../../vite.config'

config.plugins?.push(vueJsx())

export default defineConfig(config)
