import type { Plugin } from 'vitest/config'
import type { WorkspaceProject } from 'vitest/node'

const VIRTUAL_ID_CONTEXT = '\0@vitest/browser/context'
const ID_CONTEXT = '@vitest/browser/context'

export default function BrowserContext(project: WorkspaceProject): Plugin {
  return {
    name: 'vitest:browser:virtual-module:context',
    enforce: 'pre',
    resolveId(id) {
      if (id === ID_CONTEXT)
        return VIRTUAL_ID_CONTEXT
    },
    load(id) {
      if (id === VIRTUAL_ID_CONTEXT)
        return generateContextFile(project)
    },
  }
}

function generateContextFile(_project: WorkspaceProject) {
  return `
export const server = {
  platform: ${JSON.stringify(process.platform)}
}

export const page = {
  get config() {
    return __vitest_browser_runner__.config
  }
}
`
}
