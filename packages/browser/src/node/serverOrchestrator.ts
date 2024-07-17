import type { IncomingMessage, ServerResponse } from 'node:http'
import type { BrowserServer } from './server'
import { replacer } from './utils'

export async function resolveOrchestrator(
  server: BrowserServer,
  url: URL,
  res: ServerResponse<IncomingMessage>,
) {
  const project = server.project
  let contextId = url.searchParams.get('contextId')
  // it's possible to open the page without a context
  if (!contextId) {
    const contexts = [...server.state.orchestrators.keys()]
    contextId = contexts[contexts.length - 1] ?? 'none'
  }

  const files = server.state.getContext(contextId!)?.files ?? []

  const config = server.getSerializableConfig()
  const injectorJs = typeof server.injectorJs === 'string'
    ? server.injectorJs
    : await server.injectorJs

  const injector = replacer(injectorJs, {
    __VITEST_PROVIDER__: JSON.stringify(server.provider.name),
    __VITEST_CONFIG__: JSON.stringify(config),
    __VITEST_VITE_CONFIG__: JSON.stringify({
      root: server.vite.config.root,
    }),
    __VITEST_FILES__: JSON.stringify(files),
    __VITEST_TYPE__: '"orchestrator"',
    __VITEST_CONTEXT_ID__: JSON.stringify(contextId),
    __VITEST_TESTER_ID__: '"none"',
    __VITEST_PROVIDED_CONTEXT__: '{}',
  })

  // disable CSP for the orchestrator as we are the ones controlling it
  res.removeHeader('Content-Security-Policy')

  if (!server.orchestratorScripts) {
    server.orchestratorScripts = await server.formatScripts(
      project.config.browser.orchestratorScripts,
    )
  }

  let baseHtml = typeof server.orchestratorHtml === 'string'
    ? server.orchestratorHtml
    : await server.orchestratorHtml

  // if UI is enabled, use UI HTML and inject the orchestrator script
  if (project.config.browser.ui) {
    const manifestContent = server.manifest instanceof Promise
      ? await server.manifest
      : server.manifest
    const jsEntry = manifestContent['orchestrator.html'].file
    const base = server.vite.config.base || '/'
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
    __VITEST_FAVICON__: server.faviconUrl,
    __VITEST_TITLE__: 'Vitest Browser Runner',
    __VITEST_SCRIPTS__: server.orchestratorScripts,
    __VITEST_INJECTOR__: `<script type="module">${injector}</script>`,
    __VITEST_ERROR_CATCHER__: `<script type="module" src="${server.errorCatcherPath}"></script>`,
    __VITEST_CONTEXT_ID__: JSON.stringify(contextId),
  })
}
