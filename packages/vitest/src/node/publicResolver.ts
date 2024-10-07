import { readFile } from 'node:fs/promises'
import { glob } from 'tinyglobby'
import type { ResolvedConfig } from './types/config'

interface GlobOptions {
  include: string[]
  exclude: string[]
  cwd: string
}

export class TestModulesResolver {
  public testModules: FilesResolver
  public inSourceTestModules: FilesResolver
  public typecheckTestModules: FilesResolver

  constructor(config: ResolvedConfig) {
    this.testModules = new FilesResolver({
      include: config.include,
      exclude: config.exclude,
      cwd: config.dir || config.root,
    })
    this.inSourceTestModules = new InSourceFilesResolver({
      include: config.includeSource,
      exclude: config.exclude,
      cwd: config.dir || config.root,
    })
    this.typecheckTestModules = new FilesResolver({
      include: config.typecheck.include,
      exclude: config.typecheck.exclude,
      cwd: config.dir || config.root,
    })
  }

  getFiles() {
    return {
      testModules: Array.from(this.testModules.getFiles()),
      inSourceTestModules: Array.from(this.inSourceTestModules.getFiles()),
      typecheckTestModules: Array.from(this.typecheckTestModules.getFiles()),
    }
  }

  async resolve() {
    const [testModules, inSourceTestModules, typecheckTestModules] = await Promise.all([
      this.testModules.resolve(),
      this.inSourceTestModules.resolve(),
      this.typecheckTestModules.resolve(),
    ])
    return {
      testModules,
      inSourceTestModules,
      typecheckTestModules,
    }
  }

  clear() {
    this.testModules.clear()
    this.inSourceTestModules.clear()
    this.typecheckTestModules.clear()
  }
}

export class FilesResolver {
  protected files: Set<string> = new Set()
  protected _isResolved = false

  constructor(
    protected options: GlobOptions,
  ) {}

  public clear() {
    this.files.clear()
    this._isResolved = false
  }

  public getFiles() {
    return this.files
  }

  public addFile(file: string) {
    this.files.add(file)
  }

  public removeFile(file: string) {
    this.files.delete(file)
  }

  public isTestFile(file: string): boolean {
    if (!this._isResolved) {
      throw new Error('Test files were not resolved yet. Don\'t forget to call resolve() before using this API.')
    }
    return this.files.has(file)
  }

  public async resolve(): Promise<string[]> {
    if (this._isResolved) {
      return Array.from(this.files)
    }
    return this.glob()
  }

  public async glob(): Promise<string[]> {
    if (!this.options.include?.length) {
      this._isResolved = true
      return []
    }
    const files = await glob(this.options.include, {
      absolute: true,
      dot: true,
      cwd: this.options.cwd,
      ignore: this.options.exclude,
      expandDirectories: false,
    })
    this._isResolved = true
    this.files = new Set(files)
    return files
  }
}

class InSourceFilesResolver extends FilesResolver {
  override async glob(): Promise<string[]> {
    const files = await this.glob()
    const testFiles: string[] = []
    await Promise.all(
      files.map(async (file) => {
        try {
          const code = await readFile(file, 'utf-8')
          if (code.includes('import.meta.vitest')) {
            testFiles.push(file)
          }
        }
        catch {
          return null
        }
      }),
    )
    this.files = new Set(testFiles)
    return testFiles
  }
}
