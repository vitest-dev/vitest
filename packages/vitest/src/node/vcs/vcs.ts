import type { ModuleRunner } from 'vite/module-runner'
import { resolve } from 'pathe'
import { GitVCSProvider } from './git'
import { MtimeVCSProvider } from './mtime'

export interface ModuleDependency {
  /**
   * Absolute path of the file.
   */
  file: string
  /**
   * Start time of the oldest run that recorded the file, in milliseconds since the epoch.
   * A change after this time was not seen by every test file that depends on the file.
   * It is not set when the dependency comes from the static module graph.
   */
  recordedAt?: number
}

export interface ModulesResolver {
  /**
   * Every file whose change can affect the test files of the run.
   */
  // oxlint-disable-next-line typescript/method-signature-style
  getDependencies(): Promise<ModuleDependency[]>
}

export interface VCSProviderOptions {
  root: string
  changedSince?: string | boolean
  /**
   * Resolves the dependencies of the test files of the run.
   */
  resolver: ModulesResolver
}

export interface VCSProvider {
  // oxlint-disable-next-line typescript/method-signature-style
  findChangedFiles(options: VCSProviderOptions): Promise<string[]>
}

export async function loadVCSProvider(
  runner: ModuleRunner,
  vcsProvider: string | VCSProvider | undefined,
): Promise<VCSProvider> {
  if (typeof vcsProvider === 'object' && vcsProvider != null) {
    return wrapVCSProvider(vcsProvider)
  }
  if (!vcsProvider || vcsProvider === 'git') {
    return new GitVCSProvider()
  }
  if (vcsProvider === 'mtime') {
    return new MtimeVCSProvider()
  }
  const module = (await runner.import(vcsProvider)) as { default: VCSProvider }
  if (
    !module.default ||
    typeof module.default !== 'object' ||
    typeof module.default.findChangedFiles !== 'function'
  ) {
    throw new Error(
      `The vcsProvider module '${vcsProvider}' doesn't have a default export with \`findChangedFiles\` method.`,
    )
  }
  return wrapVCSProvider(module.default)
}

function wrapVCSProvider(provider: VCSProvider): VCSProvider {
  return {
    async findChangedFiles(options) {
      const changedFiles = await provider.findChangedFiles(options)
      return changedFiles.map((file) => resolve(options.root, file))
    },
  }
}
