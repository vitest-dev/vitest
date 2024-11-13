import type { Output } from 'tinyexec'
import { resolve } from 'pathe'
import { x } from 'tinyexec'

export interface GitOptions {
  changedSince?: string | boolean
}

export class VitestGit {
  private root!: string

  constructor(private cwd: string) {}

  private async resolveFilesWithGitCommand(args: string[]): Promise<string[]> {
    let result: Output

    try {
      result = await x('git', args, { nodeOptions: { cwd: this.root } })
    }
    catch (e: any) {
      e.message = e.stderr

      throw e
    }

    return result.stdout
      .split('\n')
      .filter(s => s !== '')
      .map(changedPath => resolve(this.root, changedPath))
  }

  async findChangedFiles(options: GitOptions) {
    const root = await this.getRoot(this.cwd)
    if (!root) {
      return null
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
    const [staged, unstaged] = await Promise.all([
      this.getStagedFiles(),
      this.getUnstagedFiles(),
    ])
    return [...staged, ...unstaged]
  }

  private getFilesSince(hash: string) {
    return this.resolveFilesWithGitCommand([
      'diff',
      '--name-only',
      `${hash}...HEAD`,
    ])
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

  async getRoot(cwd: string) {
    const args = ['rev-parse', '--show-cdup']

    try {
      const result = await x('git', args, { nodeOptions: { cwd } })

      return resolve(cwd, result.stdout.trim())
    }
    catch {
      return null
    }
  }
}
