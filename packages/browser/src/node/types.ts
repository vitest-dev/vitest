import type { BrowserProvider, WorkspaceProject } from 'vitest/node'

export interface BrowserCommand<T extends any[]> {
  (payload: T, options: { provider: BrowserProvider; project: WorkspaceProject }): void
}
