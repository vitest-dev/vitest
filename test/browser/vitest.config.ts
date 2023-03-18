import { defineConfig } from 'vitest/config'

const noop = () => {}

export default defineConfig({
  test: {
    browser: 'chrome',
    open: false,
    browserOptions: {
      headless: true,
    },
    outputFile: './browser.json',
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
})
