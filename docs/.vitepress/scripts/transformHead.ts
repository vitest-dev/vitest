import type { HeadConfig, TransformContext } from 'vitepress'

import { preconnectHomeLinks, preconnectLinks } from '../meta'

export const transformHead = async ({ pageData }: TransformContext): Promise<HeadConfig[]> => {
  const head: HeadConfig[] = []

  const home = pageData.relativePath === 'index.md'

  ;(home ? preconnectHomeLinks : preconnectLinks).forEach((link) => {
    head.push(['link', { rel: 'dns-prefetch', href: link }])
    head.push(['link', { rel: 'preconnect', href: link }])
  })

  head.push(['link', { rel: 'prefetch', href: '/logo.svg' }])
  if (home)
    head.push(['link', { rel: 'prefetch', href: '/netlify.svg' }])

  return head
}
