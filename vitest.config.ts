Create vitest.config.ts, which will have the higher priority and will override the configuration from vite.config.ts

Pass --config option to CLI, e.g. vitest --config ./path/to/vitest.config.ts

Use process.env.VITEST or mode property on defineConfig (will be set to test if not overridden) to conditionally apply different configuration in vite.config.ts
To configure vitest itself, add test property in your Vite config. You'll also need to add a reference to Vitest types using a triple slash command at the top of your config file, if you are importing defineConfig from vite itself.

using defineConfig from vite you should follow this:

/// <reference types="vitest" />

import { defineConfig } from 'vite'

export default defineConfig({

  test: {

    // ...

  },

})

using defineConfig from vitest/config you should follow this:

import { defineConfig } from 'vitest/config'

export default defineConfig({

  test: {

    // ...

  },

})

You can retrieve Vitest's default options to expand them if needed:

import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({

  test: {

    exclude: [...configDefaults.exclude, 'packages/template/*'],

  },

})
