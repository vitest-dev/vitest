import type { IncomingMessage, ServerResponse } from 'node:http'
import crypto from 'node:crypto'
import { stringify } from 'flatted'
import { replacer } from './utils'
import type { BrowserServer } from './server'

export async function resolveTester(
  server: BrowserServer,
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

  const { contextId, testFile } = server.resolveTesterUrl(url.pathname)
  const project = server.project
  const state = server.state
  const testFiles = await project.globTestFiles()
  // if decoded test file is "__vitest_all__" or not in the list of known files, run all tests
  const tests
    = testFile === '__vitest_all__'
    || !testFiles.includes(testFile)
      ? '__vitest_browser_runner__.files'
      : JSON.stringify([testFile])
  const iframeId = JSON.stringify(testFile)
  const context = state.getContext(contextId)
  const files = context?.files ?? []
  const method = context?.method ?? 'run'

  const injectorJs = typeof server.injectorJs === 'string'
    ? server.injectorJs
    : await server.injectorJs

  const config = server.getSerializableConfig()

  const injector = replacer(injectorJs, {
    __VITEST_PROVIDER__: JSON.stringify(server.provider.name),
    __VITEST_CONFIG__: JSON.stringify(config),
    __VITEST_FILES__: JSON.stringify(files),
    __VITEST_VITE_CONFIG__: JSON.stringify({
      root: server.vite.config.root,
    }),
    __VITEST_TYPE__: '"tester"',
    __VITEST_CONTEXT_ID__: JSON.stringify(contextId),
    __VITEST_TESTER_ID__: JSON.stringify(crypto.randomUUID()),
    __VITEST_PROVIDED_CONTEXT__: JSON.stringify(stringify(project.getProvidedContext())),
  })

  if (!server.testerScripts) {
    const testerScripts = await server.formatScripts(
      project.config.browser.testerScripts,
    )
    const clientScript = `<script type="module" src="${config.base || '/'}@vite/client"></script>`
    const stateJs = typeof server.stateJs === 'string'
      ? server.stateJs
      : await server.stateJs
    const stateScript = `<script type="module">${stateJs}</script>`
    server.testerScripts = `${stateScript}${clientScript}${testerScripts}`
  }

  const testerHtml = typeof server.testerHtml === 'string'
    ? server.testerHtml
    : await server.testerHtml

  return replacer(testerHtml, {
    __VITEST_FAVICON__: server.faviconUrl,
    __VITEST_TITLE__: 'Vitest Browser Tester',
    __VITEST_SCRIPTS__: server.testerScripts,
    __VITEST_INJECTOR__: `<script type="module">${injector}</script>`,
    __VITEST_ERROR_CATCHER__: `<script type="module" src="${server.errorCatcherPath}"></script>`,
    __VITEST_APPEND__:
      `<script type="module">
__vitest_browser_runner__.runningFiles = ${tests}
__vitest_browser_runner__.iframeId = ${iframeId}
__vitest_browser_runner__.${method === 'run' ? 'runTests' : 'collectTests'}(__vitest_browser_runner__.runningFiles)
</script>`,
  })
}
