/// <reference types="vitest" />

import assert from 'assert'
import { join } from 'pathe'
import { defineConfig } from 'vite'

const configRoot = join(__dirname, 'src')

export default defineConfig({
  root: configRoot,
  plugins: [
    {
      name: 'root-checker',
      configResolved(config) {
        assert.equal(config.root, configRoot)
      },
    },
  ],
})
