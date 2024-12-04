import { defineConfig } from '@tsslint/config'
import { convertConfig, createDisableNextLinePlugin } from '@tsslint/eslint'

export default defineConfig({
  plugins: [
    // Add support for `// eslint-disable-next-line`
    createDisableNextLinePlugin(false),
  ],
  rules: convertConfig({
    '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
    '@typescript-eslint/return-await': 'error',
    '@typescript-eslint/restrict-plus-operands': 'error',
    '@typescript-eslint/prefer-return-this-type': 'error',
    '@typescript-eslint/prefer-regexp-exec': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/prefer-find': 'error',
    '@typescript-eslint/non-nullable-type-assertion-style': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
  }),
})
