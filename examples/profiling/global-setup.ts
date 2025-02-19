import { rmSync } from 'node:fs'

export function setup() {
  rmSync('./threads-profile', { force: true, recursive: true })
  rmSync('./forks-profile', { force: true, recursive: true })
}
