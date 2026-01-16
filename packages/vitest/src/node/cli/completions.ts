import type { CAC } from 'cac'
import tab from '@bomb.sh/tab/cac'

export async function setupTabCompletions(cli: CAC): Promise<void> {
  await tab(cli, {
    subCommands: {},
    options: {
      environment(complete) {
        complete('node', 'Node.js environment')
        complete('jsdom', 'JSDOM environment')
        complete('happy-dom', 'Happy DOM environment')
        complete('edge-runtime', 'Edge runtime environment')
      },
      pool(complete) {
        complete('threads', 'Threads pool')
        complete('forks', 'Forks pool')
        complete('vmThreads', 'VM threads pool')
        complete('vmForks', 'VM forks pool')
      },
      reporter(complete) {
        complete('default', 'Default reporter')
        complete('verbose', 'Verbose reporter')
        complete('dot', 'Dot reporter')
        complete('json', 'JSON reporter')
        complete('junit', 'JUnit reporter')
        complete('html', 'HTML reporter')
        complete('tap', 'TAP reporter')
        complete('tap-flat', 'TAP flat reporter')
        complete('hanging-process', 'Hanging process reporter')
      },
      'coverage.reporter': function (complete) {
        complete('text', 'Text coverage reporter')
        complete('html', 'HTML coverage reporter')
        complete('clover', 'Clover coverage reporter')
        complete('json', 'JSON coverage reporter')
        complete('json-summary', 'JSON summary coverage reporter')
        complete('lcov', 'LCOV coverage reporter')
        complete('lcovonly', 'LCOV only coverage reporter')
        complete('teamcity', 'TeamCity coverage reporter')
        complete('cobertura', 'Cobertura coverage reporter')
      },
      'browser.name': function (complete) {
        complete('chromium', 'Chromium')
        complete('firefox', 'Mozilla Firefox')
        complete('safari', 'Safari')
        complete('chrome', 'Google Chrome')
        complete('edge', 'Microsoft Edge')
      },
      silent(complete) {
        complete('true', 'Enable silent mode')
        complete('false', 'Disable silent mode')
        complete('passed-only', 'Show logs from failing tests only')
      },
    },
  })
}
