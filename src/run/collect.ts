import { clearContext, defaultSuite } from '../suite'
import { context } from '../context'
import { File, Suite } from '../types'
import { interpretOnlyMode } from './index'

export async function collectTests(paths: string[]) {
  const files: Record<string, File> = {}

  for (const filepath of paths) {
    const file: File = {
      filepath,
      suites: [],
      collected: false,
    }

    clearContext()
    try {
      await import(filepath)

      const collectors = [defaultSuite, ...context.suites]
      for (const c of collectors) {
        context.currentSuite = c
        file.suites.push(await c.collect(file))
      }

      file.collected = true
    }
    catch (e) {
      file.error = e
      file.collected = false
      process.exitCode = 1
    }

    files[filepath] = file
  }

  const allFiles = Object.values(files)
  const allSuites = allFiles.reduce((suites, file) => suites.concat(file.suites), [] as Suite[])

  interpretOnlyMode(allSuites)
  allSuites.forEach((i) => {
    if (i.mode === 'skip')
      i.tasks.forEach(t => t.mode === 'run' && (t.mode = 'skip'))

    else
      interpretOnlyMode(i.tasks)

    i.tasks.forEach(t => t.mode === 'skip' && (t.state = 'skip'))
  })

  return files
}
