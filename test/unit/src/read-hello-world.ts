// hello-world.js
import { readFileSync } from 'node:fs'

export function readHelloWorld(path: string) {
  return readFileSync(path, 'utf-8')
}
