import type {
  DevEnvironment,
  NormalizedHotChannelClient,
  ResolvedConfig as ResolvedViteConfig,
  ViteDevServer,
} from 'vite'
import type { ResolvedConfig } from '../types/config'
import { readFile } from 'node:fs/promises'
import { basename } from 'pathe'
import { detectCodeBlock } from '../../utils/test-helpers'
import { parseFilter } from '../cli/filter'
import { filterTestFiles, globProjectTestFiles } from '../projects/globProjectFiles'

const clientEnvironments = new Set(['jsdom', 'happy-dom'])

/**
 * Bundled environments are built from a list of entry points ahead of time,
 * so every test file and setup file has to be known before the server starts.
 */
export async function setupBundledEnvironmentsInput(
  viteConfig: ResolvedViteConfig,
  configs: ResolvedConfig[],
  cliFilters: string[],
  browserEntries: string[] = [],
): Promise<void> {
  const inputs = new Map<string, Set<string>>()
  for (const name in viteConfig.environments) {
    if (viteConfig.environments[name].isBundled) {
      inputs.set(name, new Set())
    }
  }
  if (!inputs.size) {
    return
  }

  const filters = cliFilters.map((filter) => parseFilter(filter).filename)
  await Promise.all(
    configs.map(async (config) => {
      const dir = config.dir || config.root
      const testFiles = filterTestFiles(
        await globProjectTestFiles(config.include, config.exclude, config.includeSource, dir),
        filters,
        dir,
      )
      await Promise.all(
        testFiles.map(async (file) => {
          let name = 'client'
          if (!config.browser.enabled) {
            const { env = config.environment } = detectCodeBlock(await readFile(file, 'utf-8'))
            name = clientEnvironments.has(env) ? 'client' : 'ssr'
          }
          const input = inputs.get(name)
          if (!input) {
            return
          }
          config.setupFiles.forEach((setupFile) => input.add(setupFile))
          input.add(file)
          config.snapshotSerializers.forEach((serializer) => input.add(serializer))
          if (typeof config.diff === 'string') {
            input.add(config.diff)
          }
        }),
      )
    }),
  )

  const clientInput = inputs.get('client')
  if (clientInput?.size) {
    browserEntries.forEach((entry) => clientInput.add(entry))
  }

  for (const [name, input] of inputs) {
    const rolldownOptions = viteConfig.environments[name].build.rolldownOptions
    rolldownOptions.input = mergeInput(rolldownOptions.input, input)
    // entries like the diff config are imported for their exports,
    // client builds drop them by default
    rolldownOptions.preserveEntrySignatures ??= 'allow-extension'
  }
}

type RolldownInput = ResolvedViteConfig['build']['rolldownOptions']['input']

function mergeInput(
  userInput: RolldownInput,
  entries: Set<string>,
): string[] | Record<string, string> {
  if (userInput == null || typeof userInput === 'string' || Array.isArray(userInput)) {
    return Array.from(new Set([...(userInput == null ? [] : [userInput].flat()), ...entries]))
  }
  // named entries use the name as the output file name
  const input = { ...userInput }
  const files = new Set(Object.values(input))
  for (const entry of entries) {
    if (files.has(entry)) {
      continue
    }
    const name = basename(entry).replace(/\.[^.]+$/, '')
    let uniqueName = name
    for (let index = 1; uniqueName in input; index++) {
      uniqueName = `${name}~${index}`
    }
    input[uniqueName] = entry
  }
  return input
}

function getBundledEnvironments(server: ViteDevServer): DevEnvironment[] {
  return Object.values(server.environments).filter((environment) => environment.bundledDev)
}

export async function listenBundledEnvironments(server: ViteDevServer): Promise<void> {
  await Promise.all(getBundledEnvironments(server).map((environment) => environment.listen(server)))
}

type ClientConnectedListener = (payload: any, client: NormalizedHotChannelClient) => unknown

const clientConnectedListeners = new WeakMap<DevEnvironment, ClientConnectedListener[]>()
const registeredClients = new WeakMap<DevEnvironment, Map<string, Promise<void>>>()

/**
 * Bundled environments register clients in their `vite:client-connected` listeners.
 * The listeners are recorded so Vitest can call them for its own module runners.
 */
export function captureBundledDevClientListeners(server: ViteDevServer): void {
  for (const environment of getBundledEnvironments(server)) {
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
