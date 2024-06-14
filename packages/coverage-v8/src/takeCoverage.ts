/*
 * For details about the Profiler.* messages see https://chromedevtools.github.io/devtools-protocol/v8/Profiler/
 */

import inspector from 'node:inspector'
import type { Profiler } from 'node:inspector'
import { provider } from 'std-env'

const session = new inspector.Session()

export function startCoverage() {
  session.connect()
  session.post('Profiler.enable')
  session.post('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true,
  })
}

export async function takeCoverage() {
  return new Promise((resolve, reject) => {
    session.post('Profiler.takePreciseCoverage', async (error, coverage) => {
      if (error) {
        return reject(error)
      }

      // Reduce amount of data sent over rpc by doing some early result filtering
      const result = coverage.result.filter(filterResult)

      resolve({ result })
    })

    if (provider === 'stackblitz') {
      resolve({ result: [] })
    }
  })
}

export function stopCoverage() {
  session.post('Profiler.stopPreciseCoverage')
  session.post('Profiler.disable')
  session.disconnect()
}

function filterResult(coverage: Profiler.ScriptCoverage): boolean {
  if (!coverage.url.startsWith('file://')) {
    return false
  }

  if (coverage.url.includes('/node_modules/')) {
    return false
  }

  return true
}
