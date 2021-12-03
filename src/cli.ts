import { relative } from 'path'
import fg from 'fast-glob'
import { runFile } from './run'

const { log } = console

async function main() {
  const cwd = process.cwd()
  const files = await fg('test/**/*.test.ts', { absolute: true, cwd })
  for (const file of files) {
    log(`${relative(cwd, file)}`)
    await runFile(file)
    log()
  }
}

main()
