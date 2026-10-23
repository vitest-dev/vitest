import type {
  DevEnvironment,
  NormalizedHotChannelClient,
  ResolvedConfig as ResolvedViteConfig,
  ViteDevServer,
} from 'vite'
import type { ResolvedConfig } from '../types/config'
import { readFile } from 'node:fs/promises'
import { detectCodeBlock } from '../../utils/test-helpers'
import { parseFilter } from '../cli/filter'
import { filterTestFiles, globProjectTestFiles } from '../projects/globProjectFiles'

const clientEnvironments = new Set(['jsdom', 'happy-dom'])

export function getBundledEnvironmentNames(viteConfig: ResolvedViteConfig): string[] {
  return Object.entries(viteConfig.environments)
    .filter(([name, environment]) => {
      if (name === 'client' && viteConfig.test?.browser?.enabled) {
        return false
      }
      return 'isBundled' in environment && environment.isBundled === true
    })
    .map(([name]) => name)
}

/**
 * Bundled environments are built from a list of entry points ahead of time,
 * so every test file and setup file has to be known before the server starts.
 */
export async function setupBundledEnvironmentsInput(
  viteConfig: ResolvedViteConfig,
  configs: ResolvedConfig[],
  cliFilters: string[],
): Promise<void> {
  const names = getBundledEnvironmentNames(viteConfig)
  if (!names.length) {
    return
  }

  const filters = cliFilters.map((filter) => parseFilter(filter).filename)
  const inputs = new Map(names.map((name) => [name, new Set<string>()]))
  await Promise.all(
    configs.map(async (config) => {
      if (config.browser.enabled) {
        return
      }
      const dir = config.dir || config.root
      const testFiles = filterTestFiles(
        await globProjectTestFiles(config.include, config.exclude, config.includeSource, dir),
        filters,
        dir,
      )
      await Promise.all(
        testFiles.map(async (file) => {
          const { env = config.environment } = detectCodeBlock(await readFile(file, 'utf-8'))
          const input = inputs.get(clientEnvironments.has(env) ? 'client' : 'ssr')
          if (input) {
            config.setupFiles.forEach((setupFile) => input.add(setupFile))
            input.add(file)
          }
        }),
      )
    }),
  )

  for (const [name, input] of inputs) {
    const rolldownOptions = viteConfig.environments[name].build.rolldownOptions
    if (rolldownOptions.input == null) {
      rolldownOptions.input = Array.from(input)
    }
  }
}

export async function listenBundledEnvironments(server: ViteDevServer): Promise<void> {
  const names = getBundledEnvironmentNames(server.config)
  await Promise.all(names.map((name) => server.environments[name].listen(server)))
}

type ClientConnectedListener = (payload: any, client: NormalizedHotChannelClient) => unknown

const clientConnectedListeners = new WeakMap<DevEnvironment, ClientConnectedListener[]>()
const registeredClients = new WeakMap<DevEnvironment, Map<string, Promise<void>>>()

/**
 * Bundled environments register clients in their `vite:client-connected` listeners.
 * The listeners are recorded so Vitest can call them for its own module runners.
 */
export function captureBundledDevClientListeners(server: ViteDevServer): void {
  for (const name of getBundledEnvironmentNames(server.config)) {
    const environment = server.environments[name]
    const listeners: ClientConnectedListener[] = []
    clientConnectedListeners.set(environment, listeners)
    const on = environment.hot.on.bind(environment.hot)
    environment.hot.on = (event: string, listener: ClientConnectedListener) => {
      if (event === 'vite:client-connected') {
        listeners.push(listener)
      }
      on(event, listener)
    }
  }
}

/**
 * The module runner announces itself with a `vite:client-connected` event,
 * but Vitest's transport doesn't send events, so the client is registered
 * on its first lazy chunk request instead.
 */
export function ensureBundledDevClient(
  environment: DevEnvironment,
  clientId: string,
): Promise<void> {
  let clients = registeredClients.get(environment)
  if (!clients) {
    clients = new Map()
    registeredClients.set(environment, clients)
  }
  let registration = clients.get(clientId)
  if (!registration) {
    registration = registerBundledDevClient(environment, clientId)
    clients.set(clientId, registration)
  }
  return registration
}

async function registerBundledDevClient(
  environment: DevEnvironment,
  clientId: string,
): Promise<void> {
  const listeners = clientConnectedListeners.get(environment) ?? []
  const client: NormalizedHotChannelClient = { send() {} }
  await Promise.all(listeners.map((listener) => listener({ clientId }, client)))
}
