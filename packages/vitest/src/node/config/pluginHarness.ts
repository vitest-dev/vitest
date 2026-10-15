import type { Vitest } from '../core'
import { version } from '../../../package.json' with { type: 'json' }
import { defaultBrowserPort } from '../../constants'
import { Logger } from '../logger'
import { VitestPackageInstaller } from '../packageInstaller'

export class PluginHarness {
  public vitest?: Vitest

  public version: string = version

  /**
   * @internal
   */
  public _browserLastPort = defaultBrowserPort

  constructor(
    public logger: Logger = new Logger(),
    public packageInstaller: VitestPackageInstaller = new VitestPackageInstaller(),
  ) {}

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
