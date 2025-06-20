import vue from "@vitejs/plugin-vue";
import {  defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    include: ["vue"]
  }
})
