import type { ChildProcess } from 'node:child_process'
import { fork } from 'node:child_process'
import { resolve } from 'node:path'

export type WatchdogMessage = { type: 'watch'; pid: number } | { type: 'unwatch'; pid: number }

let watchdog: ChildProcess | undefined
const watched = new Set<number>()

export function watchProcess(child: ChildProcess, distPath: string): void {
  const pid = child.pid
  if (pid == null) {
    return
  }

  watchdog ??= startWatchdog(distPath)
  watched.add(pid)
  send({ type: 'watch', pid })

  child.once('exit', () => {
    watched.delete(pid)
    send({ type: 'unwatch', pid })
  })
}

export function stopWatchdog(): void {
  if (watchdog && watched.size === 0) {
    watchdog.disconnect()
    watchdog = undefined
  }
}

function send(message: WatchdogMessage) {
  if (watchdog?.connected) {
    watchdog.send(message)
  }
}

function startWatchdog(distPath: string): ChildProcess {
  /** Loads {@link file://./../../runtime/workers/watchdog.ts} */
  const child = fork(resolve(distPath, 'workers/watchdog.js'), [], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    execArgv: [],
    env: { ...process.env, NODE_OPTIONS: undefined },
  })

  // must never keep the main process alive
  child.unref()
  child.channel?.unref()

  // losing the watchdog only loses the cleanup, the test run is not affected
  child.on('error', () => {})
  child.once('exit', () => {
    if (watchdog === child) {
      watchdog = undefined
    }
  })

  return child
}
