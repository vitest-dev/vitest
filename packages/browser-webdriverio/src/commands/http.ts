import type { BrowserHttpMethod } from 'vitest/browser'
import type { BrowserCommand } from 'vitest/node'

type SerializedRouteMatcher
  = | { type: 'string'; value: string }
    | { type: 'regexp'; value: string; flags: string }

interface SerializedHttpResponse {
  status: number
  headers: [string, string][]
  body: string
}

function toPatternString(matcher: SerializedRouteMatcher): string {
  if (matcher.type !== 'string') {
    throw new Error('Only string route matcher is supported in WebDriverIO browser environment.')
  }

  return matcher.value
}

export const http: BrowserCommand<[
  BrowserHttpMethod,
  SerializedRouteMatcher,
  string,
  string,
]> = async (
  context,
  method,
  matcher,
  resolverId,
  testerId,
) => {
  const rpc = (context.project.browser!.state as any)?.testers?.get(testerId)
  if (!rpc) {
    throw new Error(`Tester RPC "${testerId}" was not found.`)
  }

  const mock = await context.browser.mock(toPatternString(matcher), {
    method,
  })

  const response: SerializedHttpResponse = await rpc.runHttpResolver(
    resolverId,
  )

  mock.respond(response.body, {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers),
  })
}
