import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect } from 'vite'
import type { ProjectBrowser } from './project'
import type { ParentBrowserProject } from './projectParent'
import crypto from 'node:crypto'
import { join } from 'pathe'
import { replacer } from './utils'

export async function resolveTester(
  globalServer: ParentBrowserProject,
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

  const sessionId = url.searchParams.get('sessionId') || 'none'
  const session = globalServer.vitest._browserSessions.getSession(sessionId)

  if (!session) {
    res.statusCode = 400
    res.end('Invalid session ID')
    return
  }

  const project = globalServer.vitest.getProjectByName(session.project.name || '')
  const browserProject = (project.browser as ProjectBrowser | undefined) || [...globalServer.children][0]

  if (!browserProject) {
    res.statusCode = 400
    res.end('Invalid session ID')
    return
  }

  const injectorJs: string = typeof globalServer.injectorJs === 'string'
    ? globalServer.injectorJs
    : await globalServer.injectorJs

  const injector = replacer(injectorJs, {
    __VITEST_PROVIDER__: JSON.stringify(project.browser!.provider.name),
    __VITEST_CONFIG__: JSON.stringify(browserProject.wrapSerializedConfig()),
    __VITEST_VITE_CONFIG__: JSON.stringify({
      root: browserProject.vite.config.root,
    }),
    __VITEST_TYPE__: '"tester"',
    __VITEST_METHOD__: JSON.stringify('none'),
    __VITEST_SESSION_ID__: JSON.stringify(sessionId),
    __VITEST_OTEL_CARRIER__: JSON.stringify(null),
    __VITEST_TESTER_ID__: JSON.stringify(crypto.randomUUID()),
    __VITEST_PROVIDED_CONTEXT__: '{}',
    __VITEST_API_TOKEN__: JSON.stringify(globalServer.vitest.config.api.token),
  })

  const testerHtml = typeof browserProject.testerHtml === 'string'
    ? browserProject.testerHtml
    : await browserProject.testerHtml

  try {
    const url = join('/@fs/', browserProject.testerFilepath)
    const indexhtml = await browserProject.vite.transformIndexHtml(url, testerHtml)
    const html = replacer(indexhtml, {
      __VITEST_FAVICON__: globalServer.faviconUrl,
      __VITEST_INJECTOR__: injector,
    })
    return html
  }
  catch (err: any) {
    session.fail(err)
    next(err)
  }
}
