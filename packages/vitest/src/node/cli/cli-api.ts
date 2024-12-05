import type { File, Suite, Task } from '@vitest/runner'
import type { UserConfig as ViteUserConfig } from 'vite'
import type { environments } from '../../integrations/env'
import type { Vitest, VitestOptions } from '../core'
import type { WorkspaceSpec } from '../pool'
import type { UserConfig, VitestEnvironment, VitestRunMode } from '../types/config'
import { mkdirSync, writeFileSync } from 'node:fs'
import { getNames, getTests } from '@vitest/runner/utils'
import { dirname, relative, resolve } from 'pathe'
import { CoverageProviderMap } from '../../integrations/coverage'
import { createVitest } from '../create'
import { FilesNotFoundError, GitNotFoundError, IncludeTaskLocationDisabledError, LocationFilterFileNotFoundError, RangeLocationFilterProvidedError } from '../errors'
import { registerConsoleShortcuts } from '../stdin'

export interface CliOptions extends UserConfig {
  /**
   * Override the watch mode
   */
  run?: boolean
  /**
   * Removes colors from the console output
   */
  color?: boolean
  /**
   * Output collected tests as JSON or to a file
   */
  json?: string | boolean
  /**
   * Output collected test files only
   */
  filesOnly?: boolean
}

/**
 * Start Vitest programmatically
 *
 * Returns a Vitest instance if initialized successfully.
 */
export async function startVitest(
  mode: VitestRunMode,
  cliFilters: string[] = [],
  options: CliOptions = {},
  viteOverrides?: ViteUserConfig,
  vitestOptions?: VitestOptions,
): Promise<Vitest> {
  const root = resolve(options.root || process.cwd())

  const ctx = await prepareVitest(
    mode,
    options,
    viteOverrides,
    vitestOptions,
  )

  if (mode === 'test' && ctx.config.coverage.enabled) {
    const provider = ctx.config.coverage.provider || 'v8'
    const requiredPackages = CoverageProviderMap[provider]

    if (requiredPackages) {
      if (
        !(await ctx.packageInstaller.ensureInstalled(requiredPackages, root, ctx.version))
      ) {
        process.exitCode = 1
        return ctx
      }
    }
  }

  const stdin = vitestOptions?.stdin || process.stdin
  const stdout = vitestOptions?.stdout || process.stdout
  let stdinCleanup
  if (stdin.isTTY && ctx.config.watch) {
    stdinCleanup = registerConsoleShortcuts(ctx, stdin, stdout)
  }

  ctx.onAfterSetServer(() => {
    if (ctx.config.standalone) {
      ctx.init()
    }
    else {
      ctx.start(cliFilters)
    }
  })

  try {
    if (ctx.config.mergeReports) {
      await ctx.mergeReports()
    }
    else if (ctx.config.standalone) {
      await ctx.init()
    }
    else {
      await ctx.start(cliFilters)
    }
  }
  catch (e) {
    if (e instanceof FilesNotFoundError) {
      return ctx
    }

    if (e instanceof GitNotFoundError) {
      ctx.logger.error(e.message)
      return ctx
    }

    if (
      e instanceof IncludeTaskLocationDisabledError
      || e instanceof RangeLocationFilterProvidedError
      || e instanceof LocationFilterFileNotFoundError
    ) {
      ctx.logger.printError(e, { verbose: false })
      return ctx
    }

    process.exitCode = 1
    ctx.logger.printError(e, { fullStack: true, type: 'Unhandled Error' })
    ctx.logger.error('\n\n')
    return ctx
  }

  if (ctx.shouldKeepServer()) {
    return ctx
  }

  stdinCleanup?.()
  await ctx.close()
  return ctx
}

export async function prepareVitest(
  mode: VitestRunMode,
  options: CliOptions = {},
  viteOverrides?: ViteUserConfig,
  vitestOptions?: VitestOptions,
): Promise<Vitest> {
  process.env.TEST = 'true'
  process.env.VITEST = 'true'
  process.env.NODE_ENV ??= 'test'

  if (options.run) {
    options.watch = false
  }

  // this shouldn't affect _application root_ that can be changed inside config
  const root = resolve(options.root || process.cwd())

  // running "vitest --browser.headless"
  if (typeof options.browser === 'object' && !('enabled' in options.browser)) {
    options.browser.enabled = true
  }

  if (typeof options.typecheck?.only === 'boolean') {
    options.typecheck.enabled ??= true
  }

  const ctx = await createVitest(mode, options, viteOverrides, vitestOptions)

  const environmentPackage = getEnvPackageName(ctx.config.environment)

  if (
    environmentPackage
    && !(await ctx.packageInstaller.ensureInstalled(environmentPackage, root))
  ) {
    process.exitCode = 1
    return ctx
  }

  return ctx
}

export function processCollected(ctx: Vitest, files: File[], options: CliOptions) {
  let errorsPrinted = false

  forEachSuite(files, (suite) => {
    const errors = suite.result?.errors || []
    errors.forEach((error) => {
      errorsPrinted = true
      ctx.logger.printError(error, {
        project: ctx.getProjectByName(suite.file.projectName),
      })
    })
  })

  if (errorsPrinted) {
    return
  }

  if (typeof options.json !== 'undefined') {
    return processJsonOutput(files, options)
  }

  return formatCollectedAsString(files).forEach(test => console.log(test))
}

export function outputFileList(files: WorkspaceSpec[], options: CliOptions) {
  if (typeof options.json !== 'undefined') {
    return outputJsonFileList(files, options)
  }

  return formatFilesAsString(files, options).map(file => console.log(file))
}

function outputJsonFileList(files: WorkspaceSpec[], options: CliOptions) {
  if (typeof options.json === 'boolean') {
    return console.log(JSON.stringify(formatFilesAsJSON(files), null, 2))
  }
  if (typeof options.json === 'string') {
    const jsonPath = resolve(options.root || process.cwd(), options.json)
    mkdirSync(dirname(jsonPath), { recursive: true })
    writeFileSync(jsonPath, JSON.stringify(formatFilesAsJSON(files), null, 2))
  }
}

function formatFilesAsJSON(files: WorkspaceSpec[]) {
  return files.map((file) => {
    const result: any = {
      file: file.moduleId,
    }

    if (file.project.name) {
      result.projectName = file.project.name
    }
    return result
  })
}

function formatFilesAsString(files: WorkspaceSpec[], options: CliOptions) {
  return files.map((file) => {
    let name = relative(options.root || process.cwd(), file.moduleId)
    if (file.project.name) {
      name = `[${file.project.name}] ${name}`
    }
    return name
  })
}

function processJsonOutput(files: File[], options: CliOptions) {
  if (typeof options.json === 'boolean') {
    return console.log(JSON.stringify(formatCollectedAsJSON(files), null, 2))
  }

  if (typeof options.json === 'string') {
    const jsonPath = resolve(options.root || process.cwd(), options.json)
    mkdirSync(dirname(jsonPath), { recursive: true })
    writeFileSync(jsonPath, JSON.stringify(formatCollectedAsJSON(files), null, 2))
  }
}

function forEachSuite(tasks: Task[], callback: (suite: Suite) => void) {
  tasks.forEach((task) => {
    if (task.type === 'suite') {
      callback(task)
      forEachSuite(task.tasks, callback)
    }
  })
}

export function formatCollectedAsJSON(files: File[]) {
  return files.map((file) => {
    const tests = getTests(file).filter(test => test.mode === 'run' || test.mode === 'queued' || test.mode === 'only')
    return tests.map((test) => {
      const result: any = {
        name: getNames(test).slice(1).join(' > '),
        file: file.filepath,
      }
      if (test.file.projectName) {
        result.projectName = test.file.projectName
      }
      if (test.location) {
        result.location = test.location
      }
      return result
    })
  }).flat()
}

export function formatCollectedAsString(files: File[]) {
  return files.map((file) => {
    const tests = getTests(file).filter(test => test.mode === 'run' || test.mode === 'queued' || test.mode === 'only')
    return tests.map((test) => {
      const name = getNames(test).join(' > ')
      if (test.file.projectName) {
        return `[${test.file.projectName}] ${name}`
      }
      return name
    })
  }).flat()
}

const envPackageNames: Record<
  Exclude<keyof typeof environments, 'node'>,
  string
> = {
  'jsdom': 'jsdom',
  'happy-dom': 'happy-dom',
  'edge-runtime': '@edge-runtime/vm',
}

function getEnvPackageName(env: VitestEnvironment) {
  if (env === 'node') {
    return null
  }
  if (env in envPackageNames) {
    return (envPackageNames as any)[env]
  }
  if (env[0] === '.' || env[0] === '/') {
    return null
  }
  return `vitest-environment-${env}`
}
