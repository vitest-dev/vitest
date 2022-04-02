import { resolve } from 'pathe'
import { execa } from 'execa'
import type { ExecaReturnValue } from 'execa'

export interface GitOptions {
  lastCommit?: boolean
  changedSince?: string
}

export class VitestGit {
  private async resolveFilesWithGitCommand(
    args: string[],
    cwd: string,
  ): Promise<string[]> {
    let result: ExecaReturnValue

    try {
      result = await execa('git', args, { cwd })
    }
    catch (e: any) {
      e.message = e.stderr

      throw e
    }

    return result.stdout
      .split('\n')
      .filter(s => s !== '')
      .map(changedPath => resolve(cwd, changedPath))
  }

  async findChangedFiles(cwd: string, options: GitOptions) {
    const changedSince = options.changedSince

    if (options && options.lastCommit) {
      return this.resolveFilesWithGitCommand(
        ['show', '--name-only', '--pretty=format:', 'HEAD', '--'],
        cwd,
      )
    }
    if (changedSince) {
      const [committed, staged, unstaged] = await Promise.all([
        this.resolveFilesWithGitCommand(
          ['diff', '--name-only', `${changedSince}...HEAD`, '--'],
          cwd,
        ),
        this.resolveFilesWithGitCommand(
          ['diff', '--cached', '--name-only', '--'],
          cwd,
        ),
        this.resolveFilesWithGitCommand(
          [
            'ls-files',
            '--other',
            '--modified',
            '--exclude-standard',
            '--',
          ],
          cwd,
        ),
      ])
      return [...committed, ...staged, ...unstaged]
    }
    const [staged, unstaged] = await Promise.all([
      this.resolveFilesWithGitCommand(
        ['diff', '--cached', '--name-only', '--'],
        cwd,
      ),
      this.resolveFilesWithGitCommand(
        [
          'ls-files',
          '--other',
          '--modified',
          '--exclude-standard',
          '--',
        ],
        cwd,
      ),
    ])
    return [...staged, ...unstaged]
  }

  async getRoot(cwd: string) {
    const options = ['rev-parse', '--show-cdup']

    try {
      const result = await execa('git', options, { cwd })

      return resolve(cwd, result.stdout)
    }
    catch {
      return null
    }
  }
}
