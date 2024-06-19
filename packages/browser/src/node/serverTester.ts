import type { IncomingMessage, ServerResponse } from 'node:http'
import { stringify } from 'flatted'
import { replacer } from './utils'
import type { BrowserServerState } from './state'

export async function resolveTester(
  state: BrowserServerState,
  url: URL,
  res: ServerResponse<IncomingMessage>,
): Promise<string> {
  const csp = res.getHeader('Content-Security-Policy')
  if (typeof csp === 'string') {
    // add frame-ancestors to allow the iframe to be loaded by Vitest,
    // but keep the rest of the CSP
    res.setHeader(
      'Content-Security-Policy',
      csp.replace(/frame-ancestors [^;]+/, 'frame-ancestors *'),
    )
  }

  const { contextId, testFile } = state.resolveTesterUrl(url.pathname)
  const project = state.project
  const testFiles = await project.globTestFiles()
  // if decoded test file is "__vitest_all__" or not in the list of known files, run all tests
  const tests
    = testFile === '__vitest_all__'
    || !testFiles.includes(testFile)
      ? '__vitest_browser_runner__.files'
      : JSON.stringify([testFile])
  const iframeId = JSON.stringify(testFile)
  const files = project.browserState.get(contextId)?.files ?? []

  const injectorJs = typeof state.injectorJs === 'string'
    ? state.injectorJs
    : await state.injectorJs

  const config = state.getSerializableConfig()

  const injector = replacer(injectorJs, {
    __VITEST_PROVIDER__: JSON.stringify(project.browserProvider!.name),
    __VITEST_CONFIG__: JSON.stringify(config),
    __VITEST_FILES__: JSON.stringify(files),
    __VITEST_VITE_CONFIG__: JSON.stringify({
      root: project.browser!.config.root,
    }),
    __VITEST_TYPE__: '"tester"',
    __VITEST_CONTEXT_ID__: JSON.stringify(contextId),
    __VITEST_PROVIDED_CONTEXT__: JSON.stringify(stringify(project.getProvidedContext())),
  })

  if (!state.testerScripts) {
    const testerScripts = await state.formatScripts(
      project.config.browser.testerScripts,
    )
    const clientScript = `<script type="module" src="${config.base || '/'}@vite/client"></script>`
    const stateJs = typeof state.stateJs === 'string'
      ? state.stateJs
      : await state.stateJs
    const stateScript = `<script type="module">${stateJs}</script>`
    state.testerScripts = `${stateScript}${clientScript}${testerScripts}`
  }

  const testerHtml = typeof state.testerHtml === 'string'
    ? state.testerHtml
    : await state.testerHtml

  return replacer(testerHtml, {
    __VITEST_FAVICON__: state.faviconUrl,
    __VITEST_TITLE__: 'Vitest Browser Tester',
    __VITEST_SCRIPTS__: state.testerScripts,
    __VITEST_INJECTOR__: injector,
    __VITEST_APPEND__:
      `<script type="module">
__vitest_browser_runner__.runningFiles = ${tests}
__vitest_browser_runner__.iframeId = ${iframeId}
__vitest_browser_runner__.runTests(__vitest_browser_runner__.runningFiles)
</script>`,
  })
}
