#!/usr/bin/env node
import * as module from 'node:module'

// Enable Node's on-disk compile cache before importing the CLI so both the CLI
// graph and (via the inherited env variable) every spawned worker skip V8
// recompilation of unchanged modules. `enableCompileCache()` only affects the
// current process — child processes pick the cache up from NODE_COMPILE_CACHE.
// Respects an explicit NODE_COMPILE_CACHE and NODE_DISABLE_COMPILE_CACHE; the
// API is not available before Node 22.8.
try {
  const result = module.enableCompileCache?.()
  if (result?.directory && !process.env.NODE_COMPILE_CACHE) {
    process.env.NODE_COMPILE_CACHE = result.directory
  }
}
catch {}

// eslint-disable-next-line antfu/no-top-level-await -- the import must not be hoisted above `enableCompileCache`
await import('./dist/cli.js')
