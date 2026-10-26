import type { Plugin } from 'vitest/config'
import type { BundledPages } from '../bundledPages'
import type { ParentBrowserProject } from '../projectParent'
import { loadBundledOrchestratorHtml } from '../serverOrchestrator'
import { loadBundledTesterHtml } from '../serverTester'

export default function BundledPagesPlugin(
  pages: BundledPages,
  getParent: () => ParentBrowserProject,
): Plugin {
  return {
    name: 'vitest:browser:bundled-pages',
    resolveId(id) {
      if (pages.pages.has(id)) {
        return id
      }
    },
    load(id) {
      const page = pages.pages.get(id)
      if (page?.type === 'tester') {
        return loadBundledTesterHtml(page, id)
      }
      if (page?.type === 'orchestrator') {
        return loadBundledOrchestratorHtml(getParent())
      }
    },
  }
}
