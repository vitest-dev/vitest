import type { UserConfig as ViteUserConfig } from 'vite'
import type { environments } from '../../integrations/env'
import type { Vitest, VitestOptions } from '../core'
import type { TestModule, TestSuite } from '../reporters/reported-tasks'
import type { TestSpecification } from '../spec'
import type { UserConfig, VitestEnvironment, VitestRunMode } from '../types/config'
import { mkdirSync, writeFileSync } from 'node:fs'
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

export function processCollected(ctx: Vitest, files: TestModule[], options: CliOptions) {
  let errorsPrinted = false

  forEachSuite(files, (suite) => {
    suite.errors().forEach((error) => {
      errorsPrinted = true
      ctx.logger.printError(error, {
        project: suite.project,
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

export function outputFileList(files: TestSpecification[], options: CliOptions) {
  if (typeof options.json !== 'undefined') {
    return outputJsonFileList(files, options)
  }

  return formatFilesAsString(files, options).map(file => console.log(file))
}

function outputJsonFileList(files: TestSpecification[], options: CliOptions) {
  if (typeof options.json === 'boolean') {
    return console.log(JSON.stringify(formatFilesAsJSON(files), null, 2))
  }
  if (typeof options.json === 'string') {
    const jsonPath = resolve(options.root || process.cwd(), options.json)
    mkdirSync(dirname(jsonPath), { recursive: true })
    writeFileSync(jsonPath, JSON.stringify(formatFilesAsJSON(files), null, 2))
  }
}

function formatFilesAsJSON(files: TestSpecification[]) {
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

function formatFilesAsString(files: TestSpecification[], options: CliOptions) {
  return files.map((file) => {
    let name = relative(options.root || process.cwd(), file.moduleId)
    if (file.project.name) {
      name = `[${file.project.name}] ${name}`
    }
    return name
  })
}

function processJsonOutput(files: TestModule[], options: CliOptions) {
  if (typeof options.json === 'boolean') {
    return console.log(JSON.stringify(formatCollectedAsJSON(files), null, 2))
  }

  if (typeof options.json === 'string') {
    const jsonPath = resolve(options.root || process.cwd(), options.json)
    mkdirSync(dirname(jsonPath), { recursive: true })
    writeFileSync(jsonPath, JSON.stringify(formatCollectedAsJSON(files), null, 2))
  }
}

function forEachSuite(modules: TestModule[], callback: (suite: TestSuite | TestModule) => void) {
  modules.forEach((testModule) => {
    callback(testModule)
    for (const suite of testModule.children.allSuites()) {
      callback(suite)
    }
  })
}

export interface TestCollectJSONResult {
  name: string
  file: string
  projectName?: string
  location?: { line: number; column: number }
}

export function formatCollectedAsJSON(files: TestModule[]) {
  const results: TestCollectJSONResult[] = []

  files.forEach((file) => {
    for (const test of file.children.allTests()) {
      if (test.result().state === 'skipped') {
        continue
      }
      const result: TestCollectJSONResult = {
        name: test.fullName,
        file: test.module.moduleId,
      }
      if (test.project.name) {
        result.projectName = test.project.name
      }
      if (test.location) {
        result.location = test.location
      }
      results.push(result)
    }
  })
  return results
}

export function formatCollectedAsString(testModules: TestModule[]) {
  const results: string[] = []

  testModules.forEach((testModule) => {
    for (const test of testModule.children.allTests()) {
      if (test.result().state === 'skipped') {
        continue
      }
      const fullName = `${test.module.task.name} > ${test.fullName}`
      results.push(
        (test.project.name ? `[${test.project.name}] ` : '') + fullName,
      )
    }
  })

  return results
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
