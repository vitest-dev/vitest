import { defineConfig } from 'vitest/config'

const noop = () => {}

export default defineConfig({
  test: {
    update: false,
    allowOnly: true,
    benchmark: {
      outputFile: './bench.json',
      reporters: ['json', {
        onInit: noop,
        onPathsCollected: noop,
        onCollected: noop,
        onFinished: noop,
        onTaskUpdate: noop,
        onTestRemoved: noop,
        onWatcherStart: noop,
        onWatcherRerun: noop,
        onServerRestart: noop,
        onUserConsoleLog: noop,
      }, 'default'],
    },
  },
})
