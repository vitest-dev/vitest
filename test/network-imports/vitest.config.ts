import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    poolOptions: {
      threads: {
        execArgv: ['--experimental-network-imports'],
      },
      forks: {
        execArgv: ['--experimental-network-imports'],
      },
      // not supported?
      //   FAIL  test/basic.test.ts [ test/basic.test.ts ]
      //   Error: ENOENT: no such file or directory, open 'http://localhost:9602/slash@3.0.0.js'
      //    ❯ Object.openSync node:fs:596:3
      //    ❯ readFileSync node:fs:464:35
      vmThreads: {
        execArgv: ['--experimental-network-imports'],
      },
    },
    // let vite serve public/slash@3.0.0.js
    api: 9602,
  },
})
