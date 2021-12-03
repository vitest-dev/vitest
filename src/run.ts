import { relative } from 'path'
import c from 'picocolors'
import chai from 'chai'
import fg from 'fast-glob'
import { clearContext, defaultSuite } from './suite'
import { context } from './context'
import { File, Options, Suite, Task, TaskResult } from './types'
import { afterEachHook, afterFileHook, afterHook, afterSuiteHook, beforeEachHook, beforeFileHook, beforeHook, beforeSuiteHook } from './hooks'
import { SnapshotPlugin } from './snapshot/index'

export async function runTasks(tasks: Task[]) {
  const results: TaskResult[] = []

  for (const task of tasks) {
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

export async function collectFiles(files: string[]) {
  const result: File[] = []

  for (const filepath of files) {
    clearContext()
    await beforeFileHook.fire(filepath)
    await import(filepath)
    const suites = [defaultSuite, ...context.suites]
    const collected: [Suite, Task[]][] = []

    for (const suite of suites) {
      context.currentSuite = suite
      const tasks = await suite.collect()
      collected.push([suite, tasks])
    }

    const file: File = {
      filepath,
      suites,
      collected,
    }

    file.collected.forEach(([, tasks]) =>
      tasks.forEach(task => task.file = file),
    )

    result.push(file)
  }

  return result
}

export async function runFile(file: File) {
  for (const [suite, tasks] of file.collected) {
    await beforeSuiteHook.fire(suite)

    let indent = 1
    if (suite.name) {
      log(' '.repeat(indent * 2) + suite.name)
      indent += 1
    }

    if (suite.mode === 'run' || suite.mode === 'only') {
      // TODO: If there is a task with 'only', skip all others
      const result = await runTasks(tasks)
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
    }
    else if (suite.mode === 'skip') {
      log(`${' '.repeat(indent * 2)}${c.inverse(c.gray(' SKIP '))}`)
    }
    else if (suite.mode === 'todo') {
      // TODO: In Jest, these suites are collected and printed together at the end of the report
      log(`${' '.repeat(indent * 2)}${c.inverse(c.gray(' TODO '))}`)
    }

    if (suite.name)
      indent -= 1

    await afterSuiteHook.fire(suite)
  }
  await afterFileHook.fire(file)
}

export async function run(options: Options = {}) {
  const { rootDir = process.cwd() } = options

  chai.use(SnapshotPlugin({
    rootDir,
    update: options.updateSnapshot,
  }))

  const paths = await fg(
    options.includes || ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    {
      absolute: true,
      cwd: options.rootDir,
      ignore: options.excludes || ['**/node_modules/**', '**/dist/**'],
    },
  )

  if (!paths.length) {
    console.error('No test files found')
    process.exitCode = 1
    return
  }

  await beforeHook.fire()
  const files = await collectFiles(paths)

  for (const file of files) {
    log(`${relative(process.cwd(), file.filepath)}`)
    await runFile(file)
    log()
  }
  await afterHook.fire()
  log()
}
