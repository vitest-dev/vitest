#!/usr/bin/env node
// A fake `tsc` used to simulate the type checker running out of memory.
// It ignores all arguments, prints a fatal heap-limit message the way V8 does,
// and then aborts (SIGABRT, exit 134) without emitting any diagnostics — exactly
// what happens when `tsc` OOMs. Vitest must not treat this as "no type errors".
import fs from 'node:fs'

// small delay so the process reliably survives the spawn/grace window before it
// dies — mirrors a real type check that runs for a while and then OOMs
setTimeout(() => {
  fs.writeSync(
    2,
    '\n<--- Last few GCs --->\n\n'
    + 'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory\n',
  )
  process.abort()
}, 500)
