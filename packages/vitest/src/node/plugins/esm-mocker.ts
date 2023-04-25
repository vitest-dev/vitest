import type { Plugin } from 'vite'
import { transformMockableFile } from '../mock'
import type { Vitest } from '../core'
import type { WorkspaceProject } from '../workspace'

export function ESMMockerPlugin(ctx: WorkspaceProject | Vitest): Plugin {
  return {
    name: 'vitest:mocker-plugin',
    enforce: 'post',
    transform(code, id) {
      return transformMockableFile(ctx, id, code, true)
    },
  }
}
