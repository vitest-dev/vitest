import { readFile } from 'node:fs/promises'
import type { Plugin } from 'vitest/config'
import type { WorkspaceProject } from 'vitest/node'
import type { WebSocketRPC } from 'vitest'
import { automockModule } from '../automocker'

export default (project: WorkspaceProject): Plugin[] => {
  return [
    {
      name: 'vitest:browser:mocker',
      enforce: 'pre',
      async load(id) {
        if (!project.browserMocker.mocks.has(id))
          return
        const mock = project.browserMocker.mocks.get(id)
        // undefined mock means there is a factory in the browser
        if (mock === undefined) {
          const reporter = project.ctx.reporters.find(r =>
            'wss' in r && 'clients' in r && (r.clients as any).size,
          ) as {
            clients: Map<any, WebSocketRPC>
          }

          if (!reporter)
            throw new Error('WebSocketReporter not found')

          const exports = await startMocking(reporter.clients, id)
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
        if (!project.browserMocker.mocks.has(id))
          return
        const mock = project.browserMocker.mocks.get(id)
        if (mock === null) {
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

async function startMocking(clients: Map<any, WebSocketRPC>, id: string) {
  const errors: unknown[] = []
  // start from the end since it's more likely that the last iframe is the one
  // who subscribed with a running test
  for (const client of [...clients.values()].reverse()) {
    try {
      const context = await client.getTestContext()
      if (!context)
        continue
      return await client.startMocking(id)
    }
    catch (err) {
      errors.push(err)
    }
  }
  console.error(errors)
  throw new AggregateError(errors, 'No clients available')
}
