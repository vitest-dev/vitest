// if changed, update also jsdocs and docs
export const defaultPort = 51204
export const defaultBrowserPort = 63315
export const defaultInspectPort = 9229

export const API_PATH = '/__vitest_api__'

export const extraInlineDeps: RegExp[] = [
  /^(?!.*node_modules).*\.mjs$/,
  /^(?!.*node_modules).*\.cjs\.js$/,
  // Vite client
  /vite\w*\/dist\/client\/env.mjs/,
]

export const CONFIG_NAMES: string[] = ['vitest.config', 'vite.config']

export const CONFIG_EXTENSIONS: string[] = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs']

export const configFiles: string[] = CONFIG_NAMES.flatMap(name =>
  CONFIG_EXTENSIONS.map(ext => name + ext),
)

export const globalApis: string[] = [
  // suite
  'suite',
  'test',
  'describe',
  'it',
  // chai
  'chai',
  'expect',
  'assert',
  // typecheck
  'expectTypeOf',
  'assertType',
  // utils
  'vitest',
  'vi',
  // hooks
  'beforeAll',
  'afterAll',
  'beforeEach',
  'afterEach',
  'onTestFinished',
  'onTestFailed',
]
