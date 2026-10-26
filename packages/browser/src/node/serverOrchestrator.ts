import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ProjectBrowser } from './project'
import type { ParentBrowserProject } from './projectParent'
import { stringify } from 'flatted'
import { resolve } from 'pathe'
import { distRoot, errorCatcherPath } from './constants'
import { prepareBundledTemplate, replacer } from './utils'

export async function resolveOrchestrator(
  globalServer: ParentBrowserProject,
  url: URL,
  res: ServerResponse<IncomingMessage>,
): Promise<string | undefined> {
  const sessionId = url.searchParams.get('sessionId')
  const session = sessionId && globalServer.vitest._browserSessions.getSession(sessionId)
  if (!session) {
    return
  }

  const browserProject = session.project.browser as ProjectBrowser | undefined
  if (!browserProject) {
    return
  }

  const injectorJs =
    typeof globalServer.injectorJs === 'string'
      ? globalServer.injectorJs
      : await globalServer.injectorJs

  const injector = replacer(injectorJs, {
    __VITEST_PROVIDER__: JSON.stringify(browserProject.config.browser.provider?.name || 'preview'),
    __VITEST_CONFIG__: JSON.stringify(browserProject.wrapSerializedConfig()),
    __VITEST_VITE_CONFIG__: JSON.stringify({
      root: browserProject.vite.config.root,
    }),
    __VITEST_METHOD__: JSON.stringify('orchestrate'),
    __VITEST_TYPE__: '"orchestrator"',
    __VITEST_SESSION_ID__: JSON.stringify(sessionId),
    __VITEST_TESTER_ID__: '"none"',
    __VITEST_OTEL_CARRIER__: JSON.stringify(session?.otelCarrier ?? null),
    __VITEST_PROVIDED_CONTEXT__: JSON.stringify(
      stringify(browserProject.project.getProvidedContext()),
    ),
    __VITEST_API_TOKEN__: JSON.stringify(globalServer.vitest.config.api.token),
  })

  // disable CSP for the orchestrator as we are the ones controlling it
  res.removeHeader('Content-Security-Policy')

  const bundledHtml = globalServer.bundledPages
    ? await globalServer.readBundledPage(globalServer.bundledPages.orchestratorId)
    : undefined
  if (bundledHtml) {
    return replacer(bundledHtml, {
      __VITEST_FAVICON__: globalServer.faviconUrl,
      __VITEST_TITLE__: 'Vitest Browser Runner',
      __VITEST_INJECTOR__: `<script type="module">${escapeInlineScript(injector)}</script>`,
      __VITEST_SESSION_ID__: JSON.stringify(sessionId),
    })
  }

  if (!globalServer.orchestratorScripts) {
    globalServer.orchestratorScripts = (
      await globalServer.formatScripts(globalServer.config.browser.orchestratorScripts)
    )
      .map((script) => {
        let html = '<script '
        for (const attr in script.attrs || {}) {
          html += `${attr}="${script.attrs![attr]}" `
        }
        html += `>${escapeInlineScript(typeof script.children === 'string' ? script.children : '')}</script>`
        return html
      })
      .join('\n')
  }

  const baseHtml = await getOrchestratorTemplate(globalServer, false)

  return replacer(baseHtml, {
    __VITEST_FAVICON__: globalServer.faviconUrl,
    __VITEST_TITLE__: 'Vitest Browser Runner',
    __VITEST_SCRIPTS__: globalServer.orchestratorScripts,
    __VITEST_INJECTOR__: `<script type="module">${escapeInlineScript(injector)}</script>`,
    __VITEST_ERROR_CATCHER__: `<script type="module" src="${globalServer.errorCatcherUrl}"></script>`,
    __VITEST_SESSION_ID__: JSON.stringify(sessionId),
  })
}

/**
 * The bundle builds the orchestrator page with its scripts, so the placeholders
 * of the scripts are replaced with the files to bundle.
 */
export async function loadBundledOrchestratorHtml(
  globalServer: ParentBrowserProject,
): Promise<string> {
  const html = await getOrchestratorTemplate(globalServer, true)
  const scripts = (globalServer.config.browser.orchestratorScripts || []).map(
    ({ content, src, async, type = 'module' }) => {
      let attrs = `type="${type}"`
      if (async) {
        attrs += ' async'
      }
      if (src) {
        attrs += ` src="${src}"`
      }
      return `<script ${attrs}>${content ? escapeInlineScript(content) : ''}</script>`
    },
  )
  return replacer(html, {
    __VITEST_SCRIPTS__: scripts.join('\n'),
    __VITEST_ERROR_CATCHER__: `<script type="module" src="${errorCatcherPath}"></script>`,
  })
}

async function getOrchestratorTemplate(
  globalServer: ParentBrowserProject,
  bundled: boolean,
): Promise<string> {
  const html =
    typeof globalServer.orchestratorHtml === 'string'
      ? globalServer.orchestratorHtml
      : await globalServer.orchestratorHtml

  // the bundle doesn't process the files Vitest serves itself
  const ignore = bundled ? 'vite-ignore ' : ''

  if (!globalServer.config.browser.ui) {
    return bundled ? prepareBundledTemplate(html) : html
  }

  // if UI is enabled, use UI HTML and inject the orchestrator script
  const manifestContent =
    globalServer.manifest instanceof Promise ? await globalServer.manifest : globalServer.manifest
  const jsEntry = manifestContent['orchestrator.html'].file
  const base = globalServer.vite.config.base || '/'
  return html
    .replace('href="./favicon.ico"', `${ignore}href="${base}__vitest__/favicon.ico"`)
    .replace('href="./favicon.svg"', `${ignore}href="${base}__vitest__/favicon.svg"`)
    .replace(/(src|href)="\.\/assets\//g, `${ignore}$1="${base}__vitest__/assets/`)
    .replace(
      '<!-- !LOAD_METADATA! -->',
      [
        `<script>window.VITEST_UI_THEME = ${JSON.stringify(globalServer.vitest.config.uiOptions.theme)}</script>`,
        '{__VITEST_INJECTOR__}',
        '{__VITEST_ERROR_CATCHER__}',
        '{__VITEST_SCRIPTS__}',
        `<script type="module" crossorigin src="${bundled ? resolve(distRoot, 'client', jsEntry) : `${base}${jsEntry}`}"></script>`,
      ].join('\n'),
    )
}

function escapeInlineScript(content: string): string {
  return content.replace(/<!--/g, '<\\!--').replace(/<\/(script)/gi, '</\\$1')
}
