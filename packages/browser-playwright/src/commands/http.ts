import type { BrowserHttpMethod, SerializedHttpResponse } from 'vitest/browser'
import type { BrowserCommand } from 'vitest/node'

type SerializedRouteMatcher
  = | { type: 'string'; value: string }
    | { type: 'regexp'; value: string; flags: string }

function deserializeMatcher(matcher: SerializedRouteMatcher): string | RegExp {
  if (matcher.type === 'string') {
    // Allow pathname-only patterns: make sure we match anywhere in the URL
    if (matcher.value.startsWith('/')) {
      return `**${matcher.value}`
    }
    return matcher.value
  }
  return new RegExp(matcher.value, matcher.flags)
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

  await context.context.route(deserializeMatcher(matcher), async (route) => {
    if (route.request().method() !== method) {
      return route.continue()
    }

    const response: SerializedHttpResponse = await rpc.runHttpResolver(
      resolverId,
    )

    return route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: response.body,
    })
  })
}
