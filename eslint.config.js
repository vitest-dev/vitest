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
      '**/assets/**',
      '**/*.timestamp-*',
      'test/core/src/self',
      'test/cache/cache/.vitest-base/results.json',
      'test/core/src/wasm/wasm-bindgen-no-cyclic',
      'test/workspaces/results.json',
      'test/workspaces-browser/results.json',
      'test/reporters/fixtures/with-syntax-error.test.js',
      'test/network-imports/public/slash@3.0.0.js',
      'test/coverage-test/src/transpiled.js',
      'test/coverage-test/src/original.ts',
      'examples/**/mockServiceWorker.js',
      'examples/sveltekit/.svelte-kit',
      'packages/browser/**/esm-client-injector.js',
    ],
  },
  {
    rules: {
      // prefer global Buffer to not initialize the whole module
      'node/prefer-global/buffer': 'off',
      'node/prefer-global/process': 'off',
      'no-empty-pattern': 'off',
      'antfu/indent-binary-ops': 'off',
      'unused-imports/no-unused-imports': 'error',
      'style/member-delimiter-style': [
        'error',
        {
          multiline: { delimiter: 'none' },
          singleline: { delimiter: 'semi' },
        },
      ],
      // let TypeScript handle this
      'no-undef': 'off',
      'ts/no-invalid-this': 'off',
      'eslint-comments/no-unlimited-disable': 'off',
      'curly': ['error', 'all'],

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
    files: [`packages/*/*.{js,mjs,d.ts}`],
    rules: {
      'antfu/no-import-dist': 'off',
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
      'unused-imports/no-unused-imports': 'off',
    },
  },
  {
    files: [
      `docs/${GLOB_SRC}`,
      `packages/web-worker/${GLOB_SRC}`,
      `test/core/${GLOB_SRC}`,
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
