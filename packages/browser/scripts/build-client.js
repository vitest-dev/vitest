// wrapper script for `node --watch`.
// this works around some issues with `vite build --watch`.
import { spawn } from 'node:child_process'

spawn('node', ['--run', 'build:client'], {
  stdio: 'inherit',
})
