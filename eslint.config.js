import antfu, { GLOB_SRC } from '@antfu/eslint-config'

export default antfu(
  {
    // Disable tests rules because we need to test with various setup
    test: false,
    ignores: [
      '**/coverage',
      '**/*.snap',
      '**/bench.json',
      'test/core/src/self',
      'test/workspaces/results.json',
      'test/reporters/fixtures/with-syntax-error.test.js',
    ],
  },
  {
    rules: {
      // prefer global Buffer to not initialize the whole module
      'node/prefer-global/buffer': 'off',

      'ts/no-invalid-this': 'off',
      'ts/quotes': ['error', 'single', {
        allowTemplateLiterals: true,
      }],

      'no-restricted-imports': [
        'error',
        {
          paths: ['path'],
        },
      ],

      'import/no-named-as-default': 'off',
    },
  },
  {
    files: [`packages/${GLOB_SRC}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['vitest', 'path'],
        },
      ],
    },
  },
  {
    // these files define vitest as peer dependency
    files: [`packages/{coverage-*,ui,browser,web-worker}/${GLOB_SRC}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['path'],
        },
      ],
    },
  },
  {
    files: ['docs/**', `packages/web-worker/${GLOB_SRC}`, `test/web-worker/${GLOB_SRC}`],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  {
    files: [`packages/vite-node/${GLOB_SRC}`],
    rules: {
      // false positive on "exports" variable
      'antfu/no-cjs-exports': 'off',
    },
  },
)
