// if changed, update also jsdocs and docs
export const defaultPort = 51204
export const defaultBrowserPort = 63315
export const defaultInspectPort = 9229

export const API_PATH = '/__vitest_api__'

export const extraInlineDeps = [
  /^(?!.*node_modules).*\.mjs$/,
  /^(?!.*node_modules).*\.cjs\.js$/,
  // Vite client
  /vite\w*\/dist\/client\/env.mjs/,
]

export const CONFIG_NAMES = ['vitest.config', 'vite.config']

const WORKSPACES_NAMES = ['vitest.workspace', 'vitest.projects']

export const CONFIG_EXTENSIONS = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs']

export const configFiles = CONFIG_NAMES.flatMap(name =>
  CONFIG_EXTENSIONS.map(ext => name + ext),
)

const WORKSPACES_EXTENSIONS = [...CONFIG_EXTENSIONS, '.json']

export const workspacesFiles = WORKSPACES_NAMES.flatMap(name =>
  WORKSPACES_EXTENSIONS.map(ext => name + ext),
)

export const globalApis = [
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
