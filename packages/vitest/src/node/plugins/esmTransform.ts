import type { Plugin } from 'vite'
import { injectVitestModule } from '../esmInjector'
import type { Vitest } from '../core'
import type { WorkspaceProject } from '../workspace'

export function ESMTransformPlugin(ctx: WorkspaceProject | Vitest): Plugin {
  return {
    name: 'vitest:mocker-plugin',
    enforce: 'post',
    transform(source, id) {
      return injectVitestModule(ctx, source, id)
    },
  }
}
