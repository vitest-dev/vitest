import type { Options } from 'tinyexec'
import type { UserConfig as ViteUserConfig } from 'vite'
import type { SerializedConfig, WorkerGlobalState } from 'vitest'
import type { TestProjectConfiguration } from 'vitest/config'
import type {
  TestCollection,
  TestModule,
  TestResult,
  TestSpecification,
  TestUserConfig,
  Vitest,
} from 'vitest/node'
import { webcrypto as crypto } from 'node:crypto'
import fs from 'node:fs'
import { Readable, Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { inspect } from 'node:util'
import { dirname, relative, resolve } from 'pathe'
import { x } from 'tinyexec'
import * as tinyrainbow from 'tinyrainbow'
import { afterEach, onTestFinished, TestRunner } from 'vitest'
import { startVitest } from 'vitest/node'
import { Cli } from './cli'

// override default colors to disable them in tests
Object.assign(tinyrainbow.default, tinyrainbow.getDefaultColors())
// @ts-expect-error not typed global
globalThis.__VITEST_GENERATE_UI_TOKEN__ = true

export interface VitestRunnerCLIOptions {
  std?: 'inherit'
  fails?: boolean
  preserveAnsi?: boolean
  tty?: boolean
  mode?: 'test' | 'benchmark'
}

export interface RunVitestConfig extends TestUserConfig {
  $viteConfig?: Omit<ViteUserConfig, 'test'>
  $cliOptions?: TestUserConfig
}

/**
 * The config is assumed to be the config on the fille system, not CLI options
 * (Note that CLI only options like "standalone" are passed as CLI options, not config options)
 * - To pass options as CLI, provide `$cliOptions` in the config object.
 * - To pass other Vite config properties, provide `$viteConfig` in the config object.
 *
 * **WARNING**
 * If the fixture in `root` has a config file, its options **WILL TAKE PRIORITY** over the ones provided here,
 * except for the ones provided in `$cliOptions`.
 */
export async function runVitest(
  config: RunVitestConfig,
  cliFilters: string[] = [],
  runnerOptions: VitestRunnerCLIOptions = {},
) {
  // Reset possible previous runs
  process.exitCode = 0
  let exitCode = process.exitCode

  // Prevent possible process.exit() calls, e.g. from --browser
  const exit = process.exit
  process.exit = (() => { }) as never

  const stdout = new Writable({
    write(chunk, __, callback) {
      if (runnerOptions.std === 'inherit') {
        process.stdout.write(chunk.toString())
      }
      callback()
    },
  })

  if (runnerOptions?.tty) {
    (stdout as typeof process.stdout).isTTY = true
  }

  const stderr = new Writable({
    write(chunk, __, callback) {
      if (runnerOptions.std === 'inherit') {
        process.stderr.write(chunk.toString())
      }
      callback()
    },
  })

  // "node:tty".ReadStream doesn't work on Github Windows CI, let's simulate it
  const stdin = new Readable({ read: () => '' }) as NodeJS.ReadStream
  stdin.isTTY = true
  stdin.setRawMode = () => stdin
  const cli = new Cli({ stdin, stdout, stderr, preserveAnsi: runnerOptions.preserveAnsi })
  // @ts-expect-error not typed global
  const currentConfig: SerializedConfig = __vitest_worker__.ctx.config

  let ctx: Vitest | undefined
  let thrown = false

  const {
    reporters,
    root,
    watch,
    maxWorkers,
    // #region cli-only options
    config: configFile,
    standalone,
    dom,
    related,
    mode,
    changed,
    shard,
    project,
    cliExclude,
    clearScreen,
    compare,
    outputJson,
    mergeReports,
    clearCache,
    // #endregion
    $cliOptions: cliOptions,
    $viteConfig: viteConfig = {},
    ...rest
  } = config

  if ((viteConfig as any).test) {
    throw new Error(`Don't pass down "viteConfig" with "test" property. Use the rest of the first argument.`)
  }

  ;(viteConfig as any).test = rest

  try {
    ctx = await startVitest(runnerOptions.mode || 'test', cliFilters, {
      root,
      config: configFile,
      standalone,
      dom,
      related,
      mode,
      changed,
      shard,
      project,
      cliExclude,
      clearScreen,
      compare,
      outputJson,
      mergeReports,
      clearCache,

      // Test cases are already run with multiple forks/threads
      maxWorkers: maxWorkers ?? 1,

      watch: watch ?? false,
      // "none" can be used to disable passing "reporter" option so that default value is used (it's not same as reporters: ["default"])
      ...(reporters === 'none' ? {} : reporters ? { reporters } : { reporters: ['verbose'] }),
      ...cliOptions,
      env: {
        NO_COLOR: 'true',
        ...rest.env,
        ...cliOptions?.env,
      },
      // override cache config with the one that was used to run `vitest` formt the CLI
      experimental: {
        fsModuleCache: rest.experimental?.fsModuleCache ?? currentConfig.experimental.fsModuleCache,
        ...cliOptions?.experimental,
      },
    }, {
      ...viteConfig,
      server: {
        // we never need a websocket connection for the root config because it doesn't connect to the browser
        // browser mode uses a separate config that doesn't inherit CLI overrides
        ws: false,
        watch: {
          // During tests we edit the files too fast and sometimes chokidar
          // misses change events, so enforce polling for consistency
          // https://github.com/vitejs/vite/blob/b723a753ced0667470e72b4853ecda27b17f546a/playground/vitestSetup.ts#L211
          usePolling: true,
          interval: 100,
          ...viteConfig.server?.watch,
        },
        ...viteConfig?.server,
      },
    }, {
      stdin,
      stdout,
      stderr,
    })
  }
  catch (e: any) {
    if (runnerOptions.fails !== true) {
      console.error(e)
    }
    thrown = true
    cli.stderr += inspect(e)
  }
  finally {
    exitCode = process.exitCode
    process.exitCode = 0

    if (TestRunner.getCurrentTest()) {
      onTestFinished(async () => {
        await ctx?.close()
        process.exit = exit
      })
    }
    else {
      afterEach(async () => {
        await ctx?.close()
        process.exit = exit
      })
    }
  }

  return {
    thrown,
    ctx,
    exitCode,
    vitest: cli,
    stdout: cli.stdout,
    stderr: cli.stderr,
    get results() {
      return ctx?.state.getTestModules() || []
    },
    errorTree() {
      return buildErrorTree(ctx?.state.getTestModules() || [])
    },
    testTree() {
      return buildTestTree(ctx?.state.getTestModules() || [])
    },
    waitForClose: async () => {
      await new Promise<void>(resolve => ctx!.onClose(resolve))
      return ctx?.closingPromise
    },
  }
}

interface CliOptions extends Partial<Options> {
  earlyReturn?: boolean
  preserveAnsi?: boolean
}

async function runCli(command: 'vitest', _options?: CliOptions | string, ...args: string[]) {
  let options = _options

  if (typeof _options === 'string') {
    args.unshift(_options)
    options = undefined
  }

  if (command === 'vitest') {
    args.push('--maxWorkers=1')
  }

  const subprocess = x(command, args, options as Options).process!
  const cli = new Cli({
    stdin: subprocess.stdin!,
    stdout: subprocess.stdout!,
    stderr: subprocess.stderr!,
    preserveAnsi: typeof _options !== 'string' ? _options?.preserveAnsi : false,
  })

  let setDone: (value?: unknown) => void
  const isDone = new Promise(resolve => (setDone = resolve))
  subprocess.on('exit', () => setDone())

  function output() {
    return {
      vitest: cli,
      exitCode: subprocess.exitCode,
      stdout: cli.stdout || '',
      stderr: cli.stderr || '',
      waitForClose: () => isDone,
    }
  }

  // Manually stop the processes so that each test don't have to do this themselves
  onTestFinished(async () => {
    if (subprocess.exitCode === null) {
      subprocess.kill()
    }

    await isDone
  })

  if ((options as CliOptions)?.earlyReturn || args.includes('--inspect') || args.includes('--inspect-brk')) {
    return output()
  }

  if (args[0] === 'init') {
    return output()
  }

  if (args[0] !== 'list' && (args.includes('--watch') || args[0] === 'watch')) {
    if (command === 'vitest') {
      // Waiting for either success or failure
      await Promise.race([
        cli.waitForStdout('Waiting for file changes'),
        cli.waitForStdout('Tests failed. Watching for file changes'),
      ])
    }
    // make sure watcher is ready
    await cli.waitForStdout('[debug] watcher is ready')
    cli.stdout = cli.stdout.replace('[debug] watcher is ready\n', '')
  }
  else {
    await isDone
  }

  return output()
}

export async function runVitestCli(_options?: CliOptions | string, ...args: string[]) {
  process.env.VITE_TEST_WATCHER_DEBUG = 'true'
  return runCli('vitest', _options, ...args)
}

export function getInternalState(): WorkerGlobalState {
  // @ts-expect-error untyped global
  return globalThis.__vitest_worker__
}

const originalFiles = new Map<string, string>()

export function createFile(file: string, content: string) {
  fs.mkdirSync(dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf-8')
  onTestFinished(() => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file)
    }
  })
}

export function editFile(file: string, callback: (content: string) => string) {
  const content = fs.readFileSync(file, 'utf-8')
  if (!originalFiles.has(file)) {
    originalFiles.set(file, content)
  }
  fs.writeFileSync(file, callback(content), 'utf-8')
  onTestFinished(() => {
    const original = originalFiles.get(file)
    if (original !== undefined) {
      fs.writeFileSync(file, original, 'utf-8')
      originalFiles.delete(file)
    }
  })
}

export function resolvePath(baseUrl: string, path: string) {
  const filename = fileURLToPath(baseUrl)
  return resolve(dirname(filename), path)
}

export type TestFsStructure = Record<
  string,
  | string
  | ViteUserConfig
  | TestProjectConfiguration[]
  | ((...args: any[]) => unknown)
  | [(...args: any[]) => unknown, { exports?: string[]; imports?: Record<string, string[]> }]
>

function getGeneratedFileContent(content: TestFsStructure[string]) {
  if (typeof content === 'string') {
    return content
  }
  if (typeof content === 'function') {
    return `await (${content})()`
  }
  if (Array.isArray(content) && typeof content[1] === 'object' && ('exports' in content[1] || 'imports' in content[1])) {
    const imports = Object.entries(content[1].imports || [])
    return `
${imports.map(([path, is]) => `import { ${is.join(', ')} } from '${path}'`)}
const results = await (${content[0]})({ ${imports.flatMap(([_, is]) => is).join(', ')} })
${(content[1].exports || []).map(e => `export const ${e} = results["${e}"]`)}
    `
  }
  if ('test' in content && content.test?.browser?.enabled && content.test?.browser?.provider?.name) {
    const name = content.test.browser.provider.name
    return `
import { ${name} } from '@vitest/browser-${name}'
const config = ${JSON.stringify(content)}
config.test.browser.provider = ${name}(${JSON.stringify(content.test.browser.provider.options || {})})
export default config
    `
  }
  return `export default ${JSON.stringify(content)}`
}

export function useFS<T extends TestFsStructure>(root: string, structure: T, ensureConfig = true) {
  const files = new Set<string>()
  const hasConfig = Object.keys(structure).some(file => file.includes('.config.'))
  if (ensureConfig && !hasConfig) {
    ;(structure as any)['./vitest.config.js'] = {}
  }
  for (const file in structure) {
    const filepath = resolve(root, file)
    files.add(filepath)
    const content = getGeneratedFileContent(structure[file])
    fs.mkdirSync(dirname(filepath), { recursive: true })
    fs.writeFileSync(filepath, String(content), 'utf-8')
  }
  onTestFinished(() => {
    if (process.env.VITEST_FS_CLEANUP !== 'false') {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
  return {
    editFile: (file: string, callback: (content: string) => string) => {
      const filepath = resolve(root, file)
      if (!files.has(filepath)) {
        throw new Error(`file ${file} is outside of the test file system`)
      }
      const content = fs.readFileSync(filepath, 'utf-8')
      fs.writeFileSync(filepath, callback(content))
    },
    createFile: (file: string, content: string) => {
      if (file.startsWith('..')) {
        throw new Error(`file ${file} is outside of the test file system`)
      }
      const filepath = resolve(root, file)
      if (files.has(filepath)) {
        throw new Error(`file ${file} already exists in the test file system`)
      }
      files.add(filepath)
      createFile(filepath, content)
    },
    statFile: (file: string): fs.Stats => {
      const filepath = resolve(root, file)

      if (relative(root, filepath).startsWith('..')) {
        throw new Error(`file ${file} is outside of the test file system`)
      }

      return fs.statSync(filepath)
    },
    resolveFile: (file: string): string => {
      return resolve(root, file)
    },
    renameFile: (oldFile: string, newFile: string) => {
      const oldFilepath = resolve(root, oldFile)
      const newFilepath = resolve(root, newFile)
      return fs.renameSync(oldFilepath, newFilepath)
    },
  }
}

export async function runInlineTests(
  structure: TestFsStructure,
  config?: RunVitestConfig,
  options?: VitestRunnerCLIOptions,
) {
  const root = resolve(process.cwd(), `vitest-test-${crypto.randomUUID()}`)
  const fs = useFS(root, structure)
  const vitest = await runVitest({
    root,
    ...config,
  }, [], options)
  return {
    fs,
    root,
    ...vitest,
    get results() {
      return vitest.ctx?.state.getTestModules() || []
    },
    testTree() {
      return buildTestTree(vitest.ctx?.state.getTestModules() || [])
    },
  }
}

export const ts = String.raw

export class StableTestFileOrderSorter {
  sort(files: TestSpecification[]) {
    return files.sort((a, b) => a.moduleId.localeCompare(b.moduleId))
  }

  shard(files: TestSpecification[]) {
    return files
  }
}

export function buildErrorTree(testModules: TestModule[]) {
  return buildTestTree(testModules, (result) => {
    if (result.state === 'failed') {
      return result.errors.map(e => e.message)
    }
    return result.state
  })
}

export function buildTestTree(testModules: TestModule[], onResult?: (result: TestResult) => unknown) {
  type TestTree = Record<string, any>

  function walkCollection(collection: TestCollection): TestTree {
    const node: TestTree = {}

    for (const child of collection) {
      if (child.type === 'suite') {
        // Recursively walk suite children
        const suiteChildren = walkCollection(child.children)
        node[child.name] = suiteChildren
      }
      else if (child.type === 'test') {
        const result = child.result()
        if (onResult) {
          node[child.name] = onResult(result)
        }
        else {
          node[child.name] = result.state
        }
      }
    }

    return node
  }

  const tree: TestTree = {}

  for (const module of testModules) {
    // Use relative module ID for cleaner output
    const key = module.relativeModuleId
    tree[key] = walkCollection(module.children)
  }

  return tree
}
