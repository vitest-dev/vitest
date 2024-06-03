import { readFile } from 'node:fs/promises'
import type { Plugin } from 'vitest/config'
import type { WorkspaceProject } from 'vitest/node'
import { automockModule } from '../automocker'

export default (project: WorkspaceProject): Plugin[] => {
  return [
    {
      name: 'vitest:browser:mocker',
      enforce: 'pre',
      async load(id) {
        const data = project.browserMocker.mocks.get(id)
        if (!data)
          return
        const { mock, sessionId } = data
        // undefined mock means there is a factory in the browser
        if (mock === undefined) {
          const rpc = project.browserRpc.testers.get(sessionId)

          if (!rpc)
            throw new Error(`WebSocket rpc was destroyed for session ${sessionId}`)

          const exports = await rpc.startMocking(id)
          const module = `const module = __vitest_mocker__.get('${id}');`
          const keys = exports.map((name) => {
            if (name === 'default')
              return `export default module['default'];`
            return `export const ${name} = module['${name}'];`
          }).join('\n')
          return `${module}\n${keys}`
        }

        // should import the same module and automock all exports
        if (mock === null)
          return

        // file is inside __mocks__
        return readFile(mock, 'utf-8')
      },
    },
    {
      name: 'vitest:browser:automocker',
      enforce: 'post',
      transform(code, id) {
        const data = project.browserMocker.mocks.get(id)
        if (!data)
          return
        if (data.mock === null) {
          const m = automockModule(code, this.parse)

          return {
            code: m.toString(),
            map: m.generateMap({ hires: 'boundary', source: id }),
          }
        }
      },
    },
  ]
}
