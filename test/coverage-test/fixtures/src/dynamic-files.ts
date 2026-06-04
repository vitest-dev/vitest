import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { onTestFinished } from 'vitest'

export async function runDynamicFileESM() {
  const fileUrl = new URL('./dynamic-file-esm.ignore.js', import.meta.url)
  const filename = fileURLToPath(fileUrl)
  onTestFinished(() => {
    if(existsSync(filename)) {
      rmSync(filename)
    }
  })

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

  const { run } = await import(/* @vite-ignore */ fileUrl.href)

  if (run() !== 'Import works') {
    throw new Error(`Failed to run ${filename}`)
  }

  return "Done"
}

export async function runDynamicFileCJS() {
  const filename = fileURLToPath(new URL('./dynamic-file-cjs.ignore.cjs', import.meta.url))

  if (existsSync(filename)) {
    rmSync(filename)
  }
  onTestFinished(() => {
    if(existsSync(filename)) {
      rmSync(filename)
    }
  })

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

  return "Done"
}
