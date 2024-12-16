import type { IncomingMessage, ServerResponse } from 'node:http'
import type { BrowserServer } from './server'
import { replacer } from './utils'

export async function resolveOrchestrator(
  globalServer: BrowserServer,
  url: URL,
  res: ServerResponse<IncomingMessage>,
) {
  let sessionId = url.searchParams.get('sessionId')
  // it's possible to open the page without a context
  if (!sessionId) {
    const contexts = [...globalServer.state.orchestrators.keys()]
    sessionId = contexts[contexts.length - 1] ?? 'none'
  }

  const contextState = globalServer.vitest._browserSessions.getSession(sessionId!)
  const files = contextState?.files ?? []
  const browserServer = contextState?.project.browser as BrowserServer || globalServer

  const injectorJs = typeof browserServer.injectorJs === 'string'
    ? browserServer.injectorJs
    : await browserServer.injectorJs

  const injector = replacer(injectorJs, {
    __VITEST_PROVIDER__: JSON.stringify(browserServer.config.browser.provider || 'preview'),
    // TODO: check when context is not found
    __VITEST_CONFIG__: JSON.stringify(browserServer.wrapSerializedConfig(contextState?.project.name || '')),
    __VITEST_VITE_CONFIG__: JSON.stringify({
      root: browserServer.vite.config.root,
    }),
    __VITEST_FILES__: JSON.stringify(files),
    __VITEST_TYPE__: '"orchestrator"',
    __VITEST_SESSION_ID__: JSON.stringify(sessionId),
    __VITEST_TESTER_ID__: '"none"',
    __VITEST_PROVIDED_CONTEXT__: '{}',
  })

  // disable CSP for the orchestrator as we are the ones controlling it
  res.removeHeader('Content-Security-Policy')

  if (!globalServer.orchestratorScripts) {
    globalServer.orchestratorScripts = (await globalServer.formatScripts(
      globalServer.config.browser.orchestratorScripts,
    )).map((script) => {
      let html = '<script '
      for (const attr in script.attrs || {}) {
        html += `${attr}="${script.attrs![attr]}" `
      }
      html += `>${script.children}</script>`
      return html
    }).join('\n')
  }

  let baseHtml = typeof globalServer.orchestratorHtml === 'string'
    ? globalServer.orchestratorHtml
    : await globalServer.orchestratorHtml

  // if UI is enabled, use UI HTML and inject the orchestrator script
  if (globalServer.config.browser.ui) {
    const manifestContent = globalServer.manifest instanceof Promise
      ? await globalServer.manifest
      : globalServer.manifest
    const jsEntry = manifestContent['orchestrator.html'].file
    const base = browserServer.vite.config.base || '/'
    baseHtml = baseHtml
      .replaceAll('./assets/', `${base}__vitest__/assets/`)
      .replace(
        '<!-- !LOAD_METADATA! -->',
        [
          '{__VITEST_INJECTOR__}',
          '{__VITEST_ERROR_CATCHER__}',
          '{__VITEST_SCRIPTS__}',
          `<script type="module" crossorigin src="${base}${jsEntry}"></script>`,
        ].join('\n'),
      )
  }

  return replacer(baseHtml, {
    __VITEST_FAVICON__: globalServer.faviconUrl,
    __VITEST_TITLE__: 'Vitest Browser Runner',
    __VITEST_SCRIPTS__: globalServer.orchestratorScripts,
    __VITEST_INJECTOR__: `<script type="module">${injector}</script>`,
    __VITEST_ERROR_CATCHER__: `<script type="module" src="${globalServer.errorCatcherUrl}"></script>`,
    __VITEST_SESSION_ID__: JSON.stringify(sessionId),
  })
}
