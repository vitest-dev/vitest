import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect } from 'vite'
import type { BrowserServer } from './server'
import crypto from 'node:crypto'
import { stringify } from 'flatted'
import { join } from 'pathe'
import { replacer } from './utils'

export async function resolveTester(
  globalServer: BrowserServer,
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

  const { sessionId, testFile } = globalServer.resolveTesterUrl(url.pathname)
  const session = globalServer.vitest._browserSessions.getSession(sessionId)
  // TODO: if no session, 400
  const project = globalServer.vitest.getProjectByName(session?.project.name ?? '')
  const { testFiles } = await project.globTestFiles()
  // if decoded test file is "__vitest_all__" or not in the list of known files, run all tests
  const tests
    = testFile === '__vitest_all__'
    || !testFiles.includes(testFile)
      ? '__vitest_browser_runner__.files'
      : JSON.stringify([testFile])
  const iframeId = JSON.stringify(testFile)
  const files = session?.files ?? []
  const method = session?.method ?? 'run'

  // TODO: test for different configurations in multi-browser instances
  const browserServer = project.browser as BrowserServer || globalServer
  const injectorJs: string = typeof browserServer.injectorJs === 'string'
    ? browserServer.injectorJs
    : await browserServer.injectorJs

  const injector = replacer(injectorJs, {
    __VITEST_PROVIDER__: JSON.stringify(project.browser!.provider.name),
    __VITEST_CONFIG__: JSON.stringify(browserServer.wrapSerializedConfig(project.name)),
    __VITEST_FILES__: JSON.stringify(files),
    __VITEST_VITE_CONFIG__: JSON.stringify({
      root: browserServer.vite.config.root,
    }),
    __VITEST_TYPE__: '"tester"',
    __VITEST_SESSION_ID__: JSON.stringify(sessionId),
    __VITEST_TESTER_ID__: JSON.stringify(crypto.randomUUID()),
    __VITEST_PROVIDED_CONTEXT__: JSON.stringify(stringify(project.getProvidedContext())),
  })

  const testerHtml = typeof browserServer.testerHtml === 'string'
    ? browserServer.testerHtml
    : await browserServer.testerHtml

  try {
    const url = join('/@fs/', browserServer.testerFilepath)
    const indexhtml = await browserServer.vite.transformIndexHtml(url, testerHtml)
    return replacer(indexhtml, {
      __VITEST_FAVICON__: globalServer.faviconUrl,
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
    session?.reject(err)
    next(err)
  }
}
