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

export async function parseFile(filepath: string) {
  clearContext()
  await import(filepath)
  const suites = [defaultSuite, ...context.suites]
  const tasks = await Promise.all(suites.map(async(suite) => {
    await beforeSuiteHook.fire(suite)
    context.currentSuite = suite
    return [suite, await suite.collect()] as [Suite, Task[]]
  }))

  const file: File = {
    filepath,
    suites,
    tasks,
  }

  file.tasks.forEach(([, tasks]) =>
    tasks.forEach(task => task.file = file),
  )

  return file
}

export async function runFile(filepath: string) {
  await beforeFileHook.fire(filepath)
  const file = await parseFile(filepath)
  for (const [suite, tasks] of file.tasks) {
    let indent = 1
    if (suite.name) {
      log(' '.repeat(indent * 2) + suite.name)
      indent += 1
    }

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

  const files = await fg(
    options.includes || ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    {
      absolute: true,
      cwd: options.rootDir,
      ignore: options.excludes || ['/node_modules/', '/dist/'],
    },
  )

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
