import c from 'picocolors'
import { clearContext, context, defaultSuite } from './suite'
import { Suite, TaskResult } from './types'

// TODO: hooks
export async function runSuite(suite: Suite) {
  const results: TaskResult[] = []

  const queue = await suite.collect()
  for (const task of queue) {
    const result: TaskResult = { task }
    try {
      await task.run()
    }
    catch (e) {
      result.error = e
    }
    results.push(result)
  }

  return results
}

// TODO: REPORTER
const { log } = console

export async function runFile(filepath: string) {
  clearContext()
  await import(filepath)
  const suites = [defaultSuite, ...context.suites]
  for (const suite of suites) {
    let indent = 1
    if (suite.name) {
      log(' '.repeat(indent * 2) + suite.name)
      indent += 1
    }

    const result = await runSuite(suite)
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
}
