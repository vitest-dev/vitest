import path from 'node:path'
import { glob } from 'tinyglobby'

// [repro]
// node test/reporters/repro.mjs  # => freeze
// rm -rf test/reporters/node_modules
// node test/reporters/repro.mjs  # => OK

// globFiles in packages/vitest/src/node/workspace.ts
const args = {
  include: ['../tests/reporters.spec.ts'],
  exclude: [
    // '../**/node_modules/**', // <-- ignore also needs to be prefixed?
    '**/node_modules/**',
    '**/dist/**',
    '**/cypress/**',
    '**/.{idea,git,cache,output,temp}/**',
    '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
  ],
  cwd: path.join(import.meta.dirname, './reportTest2'),
}

console.log('[args]', args)
const result = await glob(args.include, {
  absolute: true,
  dot: true,
  cwd: args.cwd,
  ignore: args.exclude,
  expandDirectories: false,
})

console.log('[result]', result)
