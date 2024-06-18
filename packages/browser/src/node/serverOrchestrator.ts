import type { IncomingMessage, ServerResponse } from 'node:http'
import type { BrowserServerState } from './state'
import { replacer } from './utils'

export async function resolveOrchestrator(
  state: BrowserServerState,
  url: URL,
  res: ServerResponse<IncomingMessage>,
) {
  const project = state.project
  let contextId = url.searchParams.get('contextId')
  // it's possible to open the page without a context,
  // for now, let's assume it should be the first one
  if (!contextId) {
    contextId = project.browserState.keys().next().value ?? 'none'
  }

  const files = project.browserState.get(contextId!)?.files ?? []

  const config = state.getSerializableConfig()
  const injectorJs = typeof state.injectorJs === 'string'
    ? state.injectorJs
    : await state.injectorJs

  const injector = replacer(injectorJs, {
    __VITEST_PROVIDER__: JSON.stringify(project.browserProvider!.name),
    __VITEST_CONFIG__: JSON.stringify(config),
    __VITEST_VITE_CONFIG__: JSON.stringify({
      root: project.browser!.config.root,
    }),
    __VITEST_FILES__: JSON.stringify(files),
    __VITEST_TYPE__: '"orchestrator"',
    __VITEST_CONTEXT_ID__: JSON.stringify(contextId),
  })

  // disable CSP for the orchestrator as we are the ones controlling it
  res.removeHeader('Content-Security-Policy')

  if (!state.orchestratorScripts) {
    state.orchestratorScripts = await state.formatScripts(
      project.config.browser.orchestratorScripts,
    )
  }

  let baseHtml = typeof state.orchestratorHtml === 'string'
    ? state.orchestratorHtml
    : await state.orchestratorHtml

  // if UI is enabled, use UI HTML and inject the orchestrator script
  if (project.config.browser.ui) {
    const manifestContent = state.manifest instanceof Promise
      ? await state.manifest
      : state.manifest
    const jsEntry = manifestContent['orchestrator.html'].file
    const base = project.browser!.config.base || '/'
    baseHtml = baseHtml
      .replaceAll('./assets/', `${base}__vitest__/assets/`)
      .replace(
        '<!-- !LOAD_METADATA! -->',
        [
          '<script>{__VITEST_INJECTOR__}</script>',
          '{__VITEST_SCRIPTS__}',
          `<script type="module" crossorigin src="${jsEntry}"></script>`,
        ].join('\n'),
      )
  }

  return replacer(baseHtml, {
    __VITEST_FAVICON__: state.faviconUrl,
    __VITEST_TITLE__: 'Vitest Browser Runner',
    __VITEST_SCRIPTS__: state.orchestratorScripts,
    __VITEST_INJECTOR__: injector,
    __VITEST_CONTEXT_ID__: JSON.stringify(contextId),
  })
}
