// if changed, update also jsdocs and docs
export const defaultPort = 51204

export const EXIT_CODE_RESTART = 43

export const API_PATH = '/__vitest_api__'

export const CONFIG_NAMES = [
  'vitest.config',
  'vite.config',
]

const WORKSPACES_NAMES = [
  'vitest.workspaces',
  'vitest.projects',
  'vite.workspaces',
  'vite.projects',
]

const CONFIG_EXTENSIONS = [
  '.ts',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
]

export const configFiles = CONFIG_NAMES.flatMap(name =>
  CONFIG_EXTENSIONS.map(ext => name + ext),
)

export const workspacesFiles = WORKSPACES_NAMES.flatMap(name =>
  CONFIG_EXTENSIONS.map(ext => name + ext),
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
]
