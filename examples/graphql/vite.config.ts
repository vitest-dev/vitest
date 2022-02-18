/// <reference types="vitest" />

import { defineConfig } from 'vite'
import graphql from '@rollup/plugin-graphql'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [graphql()],
})
