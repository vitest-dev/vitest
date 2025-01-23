import type { IncomingMessage } from 'node:http'
import crypto from 'node:crypto'
import net from 'node:net'
import type { ResolvedConfig } from 'vite'
import type { ResolvedConfig as VitestResolvedConfig } from '../types/config'

// based on
// https://github.com/vitejs/vite/blob/9654348258eaa0883171533a2b74b4e2825f5fb6/packages/vite/src/node/server/middlewares/hostCheck.ts

const isFileOrExtensionProtocolRE = /^(?:file|.+-extension):/i

function getAdditionalAllowedHosts(
  resolvedServerOptions: Pick<ResolvedConfig['server'], 'host' | 'hmr' | 'origin'>,
  resolvedPreviewOptions: Pick<ResolvedConfig['preview'], 'host'>,
): string[] {
  const list = []

  // allow host option by default as that indicates that the user is
  // expecting Vite to respond on that host
  if (
    typeof resolvedServerOptions.host === 'string'
    && resolvedServerOptions.host
  )
    list.push(resolvedServerOptions.host)

  if (
    typeof resolvedServerOptions.hmr === 'object'
    && resolvedServerOptions.hmr.host
  )
    list.push(resolvedServerOptions.hmr.host)

  if (
    typeof resolvedPreviewOptions.host === 'string'
    && resolvedPreviewOptions.host
  )
    list.push(resolvedPreviewOptions.host)

  // allow server origin by default as that indicates that the user is
  // expecting Vite to respond on that host
  if (resolvedServerOptions.origin) {
    try {
      const serverOriginUrl = new URL(resolvedServerOptions.origin)
      list.push(serverOriginUrl.hostname)
    }
    catch {}
  }

  return list
}

// Based on webpack-dev-server's `checkHeader` function: https://github.com/webpack/webpack-dev-server/blob/v5.2.0/lib/Server.js#L3086
// https://github.com/webpack/webpack-dev-server/blob/v5.2.0/LICENSE
function isHostAllowedWithoutCache(
  allowedHosts: string[],
  additionalAllowedHosts: string[],
  host: string,
): boolean {
  if (isFileOrExtensionProtocolRE.test(host))
    return true

  // We don't care about malformed Host headers,
  // because we only need to consider browser requests.
  // Non-browser clients can send any value they want anyway.
  //
  // `Host = uri-host [ ":" port ]`
  const trimmedHost = host.trim()

  // IPv6
  if (trimmedHost[0] === '[') {
    const endIpv6 = trimmedHost.indexOf(']')
    if (endIpv6 < 0)
      return false

    // DNS rebinding attacks does not happen with IP addresses
    return net.isIP(trimmedHost.slice(1, endIpv6)) === 6
  }

  // uri-host does not include ":" unless IPv6 address
  const colonPos = trimmedHost.indexOf(':')
  const hostname
    = colonPos === -1 ? trimmedHost : trimmedHost.slice(0, colonPos)

  // DNS rebinding attacks does not happen with IP addresses
  if (net.isIP(hostname) === 4)
    return true

  // allow localhost and .localhost by default as they always resolve to the loopback address
  // https://datatracker.ietf.org/doc/html/rfc6761#section-6.3
  if (hostname === 'localhost' || hostname.endsWith('.localhost'))
    return true

  for (const additionalAllowedHost of additionalAllowedHosts) {
    if (additionalAllowedHost === hostname)
      return true
  }

  for (const allowedHost of allowedHosts) {
    if (allowedHost === hostname)
      return true

    // allow all subdomains of it
    // e.g. `.foo.example` will allow `foo.example`, `*.foo.example`, `*.*.foo.example`, etc
    if (
      allowedHost[0] === '.'
      && (allowedHost.slice(1) === hostname || hostname.endsWith(allowedHost))
    )
      return true
  }

  return false
}

/**
 * @param vitestConfig
 * @param viteConfig resolved config
 * @param host the value of host header. See [RFC 9110 7.2](https://datatracker.ietf.org/doc/html/rfc9110#name-host-and-authority).
 */
function isHostAllowed(vitestConfig: VitestResolvedConfig, viteConfig: ResolvedConfig, host: string): boolean {
  const apiAllowedHosts = vitestConfig.api.allowedHosts ?? []
  if (apiAllowedHosts === true)
    return true

  // Vitest only validates websocket upgrade request, so caching won't probably matter.
  return isHostAllowedWithoutCache(
    apiAllowedHosts,
    getAdditionalAllowedHosts(viteConfig.server, viteConfig.preview),
    host,
  )
}

export function isValidApiRequest(vitestConfig: VitestResolvedConfig, viteConfig: ResolvedConfig, req: IncomingMessage): boolean {
  const url = new URL(req.url ?? '', 'http://localhost')

  // validate token. token is injected in ui/tester/orchestrator html, which is cross origin proteced.
  try {
    const token = url.searchParams.get('token')
    if (!token || !crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(vitestConfig.api.token),
    ))
      return false
  }
  catch {
    // an error is thrown when the length is incorrect
    return false
  }

  // host check to prevent DNS rebinding attacks
  // (websocket upgrade request cannot be http2 even on `wss`, so `host` header is guaranteed.)
  if (!req.headers.host || !isHostAllowed(vitestConfig, viteConfig, req.headers.host))
    return false

  return true
}
