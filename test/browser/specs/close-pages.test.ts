import type { BrowserProviderOption, TestModule } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'
import { instances, provider } from './utils'

const basicTest = `
import { test } from 'vitest'
test('works', () => {})
`

const slowTest = `
import { test } from 'vitest'
test('works', async () => {
  await new Promise(resolve => setTimeout(resolve, 2000))
})
`

// records when the provider is asked to close a page, without replacing it
function trackClosedPages(events: string[], name: string): BrowserProviderOption {
  return {
    ...provider,
    providerFactory(project) {
      const instance = provider.providerFactory(project)
      const closePage = instance.closePage?.bind(instance)
      if (closePage) {
        instance.closePage = async (sessionId: string) => {
          events.push(`closed ${name}`)
          await closePage(sessionId)
        }
      }
      return instance
    },
  }
}

function browserProject(events: string[], name: string) {
  return {
    test: {
      name,
      include: [`${name}/**`],
      browser: {
        enabled: true,
        headless: true,
        provider: trackClosedPages(events, name),
        instances: [{ ...instances[0] }],
      },
    },
  }
}

test.runIf(provider.name === 'playwright')('closes the pages of a project that has no test files left', async () => {
  const events: string[] = []

  const { stderr } = await runInlineTests({
    'fast/basic.test.ts': basicTest,
    'slow/basic.test.ts': slowTest,
  }, {
    watch: false,
    reporters: [{
      onTestModuleEnd(module: TestModule) {
        events.push(`finished ${module.project.name.split(' ')[0]}`)
      },
    }],
    projects: [
      browserProject(events, 'fast'),
      browserProject(events, 'slow'),
    ],
  } as any)

  expect(stderr).toBe('')

  expect(events).toStrictEqual(['finished fast', 'closed fast', 'finished slow', 'closed slow'])
})
