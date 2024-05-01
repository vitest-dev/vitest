import { Console } from 'node:console'
import { Writable } from 'node:stream'
import { expect, it, vi } from 'vitest'
import { runVitest } from '../../test-utils'

it('plugin hooks', async () => {
  // capture console on main process
  let stdout = ''
  vi.stubGlobal('console', new Console({
    stdout: new Writable({
      write: (data, _, callback) => {
        stdout += String(data)
        callback()
      },
    }),
  }))
  await runVitest({ root: './fixtures/plugin' })
  vi.unstubAllGlobals()

  const lines = stdout.split('\n').filter(line => line.startsWith('##test##'))
  expect(lines.slice(0, 5)).toEqual([
    '##test## configureServer(pre)',
    '##test## configureServer(default)',
    '##test## buildStart(pre)',
    '##test## buildStart(default)',
    '##test## resolveId(pre)',
  ])
})
