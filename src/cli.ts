import { relative } from 'path'
import fg from 'fast-glob'
import c from 'picocolors'
import { run } from './run'
import { context } from '.'

const { log } = console

async function main() {
  const cwd = process.cwd()
  const files = await fg('test/**/*.test.ts', { absolute: true, cwd })
  for (const file of files) {
    log(`${relative(cwd, file)}`)

    context.suites.length = 1
    await import(file)
    for (const suite of context.suites) {
      let indent = 1
      if (suite.name) {
        log(' '.repeat(indent * 2) + suite.name)
        indent += 1
      }

      const result = await run(suite)
      for (const r of result) {
        if (r.error === undefined) {
          log(`${' '.repeat(indent * 2)}${c.inverse(c.green(' PASS '))} ${c.green(r.task.name)}`)
        }
        else {
          console.error(`${' '.repeat(indent * 2)}${c.inverse(c.red(' FAIL '))} ${c.red(r.task.name)}`)
          console.error(' '.repeat((indent + 2) * 2) + c.red(String(r.error)))
          process.exitCode = 1
        }
      }

      if (suite.name)
        indent -= 1
    }

    log()
  }
}

main()
