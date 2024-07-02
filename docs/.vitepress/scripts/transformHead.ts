import type { HeadConfig, TransformContext } from 'vitepress'

import { preconnectHomeLinks, preconnectLinks } from '../meta'

export async function transformHead({ pageData }: TransformContext): Promise<HeadConfig[]> {
  const head: HeadConfig[] = []

  const home = pageData.relativePath === 'index.md'

  ;(home ? preconnectHomeLinks : preconnectLinks).forEach((link) => {
    head.push(['link', { rel: 'dns-prefetch', href: link }])
    head.push(['link', { rel: 'preconnect', href: link }])
  })

  head.push(['link', { rel: 'prefetch', href: '/logo.svg', as: 'image' }])
  if (home) {
    head.push(['link', { rel: 'prefetch', href: '/logo-shadow.svg', as: 'image' }])
    head.push(['link', { rel: 'prefetch', href: '/sponsors/antfu.svg', as: 'image' }])
    head.push(['link', { rel: 'prefetch', href: '/sponsors/sheremet-va.svg', as: 'image' }])
    head.push(['link', { rel: 'prefetch', href: '/sponsors/patak-dev.svg', as: 'image' }])
    head.push(['link', { rel: 'prefetch', href: '/netlify.svg', as: 'image' }])
  }

  return head
}
