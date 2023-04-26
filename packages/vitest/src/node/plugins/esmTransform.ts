import type { Plugin } from 'vite'
import { injectVitestModule } from '../esmInjector'
import type { Vitest } from '../core'
import type { WorkspaceProject } from '../workspace'

export function ESMTransformPlugin(ctx: WorkspaceProject | Vitest): Plugin {
  return {
    name: 'vitest:mocker-plugin',
    enforce: 'post',
    transform(source, id) {
      return injectVitestModule(source, id, (code, options) => this.parse(code, options), {
        hijackESM: (ctx.config.browser.enabled && ctx.config.slowHijackESM) ?? false,
        cacheDir: ctx.server.config.cacheDir,
      })
    },
  }
}
