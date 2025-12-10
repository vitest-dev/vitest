// wrapper script for node --watch
import { spawn } from 'node:child_process'

spawn('node', ['--run', 'build:client'], {
  stdio: 'inherit',
})
