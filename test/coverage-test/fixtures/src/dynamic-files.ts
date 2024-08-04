import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

export async function runDynamicFileESM() {
  const filename = fileURLToPath(new URL('./dynamic-file-esm.ignore.js', import.meta.url))

  if (existsSync(filename)) {
    rmSync(filename)
  }

  writeFileSync(filename, `
// File created by coverage/fixtures/src/dynamic-files.ts
export function run() {
  return "Import works"
}
function uncovered() {}
  `.trim(), 'utf-8')

  const { run } = await import(/* @vite-ignore */ filename)

  if (run() !== 'Import works') {
    throw new Error(`Failed to run ${filename}`)
  }

  rmSync(filename)

  return "Done"
}

export async function runDynamicFileCJS() {
  const filename = fileURLToPath(new URL('./dynamic-file-cjs.ignore.cjs', import.meta.url))

  if (existsSync(filename)) {
    rmSync(filename)
  }

  writeFileSync(filename, `
// File created by coverage/fixtures/src/dynamic-files.ts
module.exports.run = function run() {
  return "Import works"
}
function uncovered() {}
  `.trim(), 'utf-8')

  const { run } = createRequire(import.meta.url)(filename)

  if (run() !== 'Import works') {
    throw new Error(`Failed to run ${filename}`)
  }

  rmSync(filename)

  return "Done"
}
