import type { Output } from 'tinyexec'
import type { VCSProvider, VCSProviderOptions } from './vcs'
import { resolve } from 'pathe'
import { NonZeroExitError, x } from 'tinyexec'
import { GitCommandError, GitNotFoundError } from '../errors'

export class GitVCSProvider implements VCSProvider {
  private root!: string

  private async resolveFilesWithGitCommand(args: string[]): Promise<string[]> {
    let result: Output

    try {
      result = await x('git', args, { nodeOptions: { cwd: this.root }, throwOnError: true })
    } catch (error) {
      if (error instanceof NonZeroExitError) {
        throw new GitCommandError(args, error.output?.stderr.trim() || error.message)
      }
      throw error
    }

    return result.stdout
      .split('\n')
      .filter((s) => s !== '')
      .map((changedPath) => resolve(this.root, changedPath))
  }

  async findChangedFiles(options: VCSProviderOptions): Promise<string[]> {
    const root = this.root || (await this.getRoot(options.root))
    if (!root) {
      throw new GitNotFoundError()
    }

    this.root = root

    const changedSince = options.changedSince
    if (typeof changedSince === 'string') {
      const [committed, staged, unstaged] = await Promise.all([
        this.getFilesSince(changedSince),
        this.getStagedFiles(),
        this.getUnstagedFiles(),
      ])
      return [...committed, ...staged, ...unstaged]
    }
    const [staged, unstaged] = await Promise.all([this.getStagedFiles(), this.getUnstagedFiles()])
    return [...staged, ...unstaged]
  }

  private getFilesSince(hash: string) {
    return this.resolveFilesWithGitCommand(['diff', '--name-only', `${hash}...HEAD`])
  }

  private getStagedFiles() {
    return this.resolveFilesWithGitCommand(['diff', '--cached', '--name-only'])
  }

  private getUnstagedFiles() {
    return this.resolveFilesWithGitCommand([
      'ls-files',
      '--other',
      '--modified',
      '--exclude-standard',
    ])
  }

  async getRoot(cwd: string): Promise<string | null> {
    const args = ['rev-parse', '--show-cdup']

    try {
      const result = await x('git', args, { nodeOptions: { cwd }, throwOnError: true })

      return resolve(cwd, result.stdout.trim())
    } catch {
      return null
    }
  }
}
