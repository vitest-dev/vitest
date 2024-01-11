import antfu, { GLOB_SRC } from '@antfu/eslint-config'

export default antfu(
  {
    // Disable tests rules because we need to test with various setup
    test: false,
    // This replaces the old `.gitignore`
    ignores: [
      '**/coverage',
      '**/*.snap',
      '**/bench.json',
      '**/fixtures',
      'test/core/src/self',
      'test/workspaces/results.json',
      'test/reporters/fixtures/with-syntax-error.test.js',
      'examples/**/mockServiceWorker.js',
    ],
  },
  {
    rules: {
      // prefer global Buffer to not initialize the whole module
      'node/prefer-global/buffer': 'off',
      'node/prefer-global/process': 'off',
      'no-empty-pattern': 'off',

      'ts/no-invalid-this': 'off',

      // TODO: migrate and turn it back on
      'ts/ban-types': 'off',

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
    files: [
      `docs/${GLOB_SRC}`,
    ],
    rules: {
      'style/max-statements-per-line': 'off',
      'import/newline-after-import': 'off',
      'import/first': 'off',
    },
  },
  {
    files: [
      `docs/${GLOB_SRC}`,
      `packages/web-worker/${GLOB_SRC}`,
      `test/web-worker/${GLOB_SRC}`,
    ],
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
