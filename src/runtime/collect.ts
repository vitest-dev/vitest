import { basename } from 'path'
import { File, Suite, Test } from '../types'
import { interpretOnlyMode } from '../utils'
import { clearContext, createSuiteHooks, defaultSuite } from './suite'
import { context } from './context'
import { setHooks } from './map'

export async function collectTests(paths: string[]) {
  const files: Record<string, File> = {}

  for (const filepath of paths) {
    const file: File = {
      name: basename(filepath),
      type: 'suite',
      mode: 'run',
      computeMode: 'serial',
      filepath,
      children: [],
    }

    setHooks(file, createSuiteHooks())

    clearContext()
    try {
      await import(filepath)

      for (const c of [defaultSuite, ...context.children]) {
        if (c.type === 'test') {
          file.children.push(c)
        }
        else {
          const suite = await c.collect(file)
          if (suite.name || suite.children.length)
            file.children.push(suite)
        }
      }
    }
    catch (e) {
      file.result = {
        start: performance.now(),
        state: 'fail',
        error: e,
      }
      process.exitCode = 1
    }

    files[filepath] = file
  }

  const allFiles = Object.values(files)
  const allChildren = allFiles.reduce((children, file) => children.concat(file.children), [] as (Suite | Test)[])

  interpretOnlyMode(allChildren)
  allChildren.forEach((i) => {
    if (i.type === 'suite') {
      if (i.mode === 'skip')
        i.children.forEach(c => c.mode === 'run' && (c.mode = 'skip'))
      else
        interpretOnlyMode(i.children)
    }
  })

  return files
}
