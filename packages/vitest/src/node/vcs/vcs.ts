import type { ModuleRunner } from 'vite/module-runner'
import { resolve } from 'pathe'
import { GitVCSProvider } from './git'

export interface VCSProviderOptions {
  root: string
  changedSince?: string | boolean
}

export interface VCSProvider {
  // eslint-disable-next-line ts/method-signature-style
  findChangedFiles(options: VCSProviderOptions): Promise<string[]>
}

export async function loadVCSProvider(runner: ModuleRunner, vcsProvider: string | VCSProvider | undefined): Promise<VCSProvider> {
  if (typeof vcsProvider === 'object' && vcsProvider != null) {
    return vcsProvider
  }
  if (!vcsProvider || vcsProvider === 'git') {
    return new GitVCSProvider()
  }
  const module = await runner.import(vcsProvider) as { default: VCSProvider }
  if (!module.default || typeof module.default !== 'object' || typeof module.default.findChangedFiles !== 'function') {
    throw new Error(`The vcsProvider module '${vcsProvider}' doesn't have a default export with \`findChangedFiles\` method.`)
  }
  return {
    async findChangedFiles(options) {
      const changedFiles = await module.default.findChangedFiles(options)
      return changedFiles.map(file => resolve(options.root, file))
    },
  }
}
