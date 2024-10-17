import type { IncomingMessage, ServerResponse } from 'node:http'
import crypto from 'node:crypto'
import { stringify } from 'flatted'
import type { Connect } from 'vite'
import { replacer } from './utils'
import type { BrowserServer } from './server'

export async function resolveTester(
  server: BrowserServer,
  url: URL,
  res: ServerResponse<IncomingMessage>,
  next: Connect.NextFunction,
): Promise<string | undefined> {
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
  const { testFiles } = await project.globTestFiles()
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

  const injector = replacer(injectorJs, {
    __VITEST_PROVIDER__: JSON.stringify(server.provider.name),
    __VITEST_CONFIG__: JSON.stringify(server.getSerializableConfig()),
    __VITEST_FILES__: JSON.stringify(files),
    __VITEST_VITE_CONFIG__: JSON.stringify({
      root: server.vite.config.root,
    }),
    __VITEST_TYPE__: '"tester"',
    __VITEST_CONTEXT_ID__: JSON.stringify(contextId),
    __VITEST_TESTER_ID__: JSON.stringify(crypto.randomUUID()),
    __VITEST_PROVIDED_CONTEXT__: JSON.stringify(stringify(project.getProvidedContext())),
  })

  const testerHtml = typeof server.testerHtml === 'string'
    ? server.testerHtml
    : await server.testerHtml

  try {
    const indexhtml = await server.vite.transformIndexHtml(url.pathname, testerHtml)
    return replacer(indexhtml, {
      __VITEST_INJECTOR__: injector,
      __VITEST_APPEND__: `
    __vitest_browser_runner__.runningFiles = ${tests}
    __vitest_browser_runner__.iframeId = ${iframeId}
    __vitest_browser_runner__.${method === 'run' ? 'runTests' : 'collectTests'}(__vitest_browser_runner__.runningFiles)
    document.querySelector('script[data-vitest-append]').remove()
    `,
    })
  }
  catch (err) {
    context?.reject(err)
    next(err)
  }
}
