import { relative } from 'path'
import c from 'picocolors'
import chai from 'chai'
import fg from 'fast-glob'
import { clearContext, defaultSuite } from './suite'
import { context } from './context'
import { Options, Suite, TaskResult } from './types'
import { afterEachHook, afterFileHook, afterHook, afterSuiteHook, beforeEachHook, beforeFileHook, beforeHook, beforeSuiteHook } from './hooks'
import { SnapshotPlugin } from './snapshot'

export async function runSuite(suite: Suite) {
  const results: TaskResult[] = []

  const queue = await suite.collect()
  for (const task of queue) {
    const result: TaskResult = { task }
    await beforeEachHook.fire(task)
    try {
      await task.fn()
    }
    catch (e) {
      result.error = e
    }
    results.push(result)
    await afterEachHook.fire(task, result)
  }

  return results
}

// TODO: REPORTER
const { log } = console

export async function runFile(filepath: string) {
  clearContext()
  await beforeFileHook.fire(filepath)
  await import(filepath)
  const suites = [defaultSuite, ...context.suites]
  for (const suite of suites) {
    await beforeSuiteHook.fire(suite)
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

    await afterSuiteHook.fire(suite)
  }
  await afterFileHook.fire(filepath)
}

export async function run(options: Options = {}) {
  const { rootDir = process.cwd() } = options

  chai.use(SnapshotPlugin({
    rootDir,
    update: options.updateSnapshot,
  }))

  const files = await fg(options.includes || ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'], {
    absolute: true,
    cwd: options.rootDir,
  })

  if (!files.length) {
    console.error('No test files found')
    process.exitCode = 1
    return
  }

  await beforeHook.fire()
  for (const file of files) {
    log(`${relative(process.cwd(), file)}`)
    await runFile(file)
    log()
  }
  await afterHook.fire()
  log()
}
