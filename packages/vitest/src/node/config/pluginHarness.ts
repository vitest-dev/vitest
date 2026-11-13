import type { Vitest } from '../core'
import { version } from '../../../package.json' with { type: 'json' }
import { defaultBrowserPort } from '../../constants'
import { ResultsCache } from '../cache/results'
import { Logger } from '../logger'
import { VitestPackageInstaller } from '../packageInstaller'

export class PluginHarness {
  public vitest?: Vitest

  public version: string = version

  /**
   * @internal
   */
  public _browserLastPort = defaultBrowserPort
  /**
   * @internal
   */
  public _prewarmedBrowsers = 0
  /**
   * @internal
   */
  public _lastSeed: string | undefined
  private _results: ResultsCache | undefined

  constructor(
    public logger: Logger = new Logger(),
    public packageInstaller: VitestPackageInstaller = new VitestPackageInstaller(),
  ) {}

  /**
   * The results cache lives as long as the harness, so the config resolution and Vitest share it.
   * @internal
   */
  _getResults(cacheDir: string | null): ResultsCache {
    if (this._results?.cacheDir !== cacheDir) {
      this._results = new ResultsCache(this, cacheDir)
    }
    return this._results
  }

  setVitest(vitest: Vitest | undefined): this {
    this.vitest = vitest
    return this
  }

  getVitest(): Vitest {
    if (!this.vitest) {
      throw new Error(`Don't have access to the "vitest" instance yet. This is a bug in Vitest.`)
    }
    return this.vitest
  }
}
