import type { Theme } from 'vitepress'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import { inBrowser } from 'vitepress'
import VitestTheme from '@voidzero-dev/vitepress-theme/src/vitest'
import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client'
import Version from '../components/Version.vue'
import CRoot from '../components/CRoot.vue'
import Deprecated from '../components/Deprecated.vue'
import Experimental from '../components/Experimental.vue'
import Advanced from '../components/Advanced.vue'
import CourseLink from '../components/CourseLink.vue'
import './styles.css'
import '@shikijs/vitepress-twoslash/style.css'
import 'virtual:group-icons.css'

if (inBrowser) {
  // redirect old hash links (e.g. /config/#reporters -> /config/reporters)
  // before hydration to avoid SSG hydration mismatch
  const redirect = getRedirectPath(new URL(location.href))
  if (redirect) {
    location.replace(redirect)
  }
  import('./pwa')
}

function getRedirectPath(url: URL) {
  if (url.pathname === '/api/' || url.pathname === '/api' || url.pathname === '/api/index.html') {
    return '/api/test'
  }
  if (!url.hash) {
    return
  }

  // /config/#reporters           -> /config/reporters
  // /config/#coverage-provider   -> /config/coverage#coverage-provider
  // /config/#browser.enabled     -> /config/browser/enabled
  if (url.pathname === '/config' || url.pathname === '/config/' || url.pathname === '/config.html') {
    if (url.hash.startsWith('#browser.')) {
      const [page, ...hash] = url.hash.slice('#browser.'.length).toLowerCase().split('-')
      return `/config/browser/${page}${hash.length ? `#${[page, ...hash].join('-')}` : ''}`
    }
    const [page, ...hash] = url.hash.slice(1).toLowerCase().split('-')
    return `/config/${page}${hash.length ? `#${[page, ...hash].join('-')}` : ''}`
  }
  // /guide/browser/config#browser.locators-testidattribute -> /config/browser/locators#browser-locators-testidattribute
  if (url.pathname === '/guide/browser/config' || url.pathname === '/guide/browser/config/' || url.pathname === '/guide/browser/config.html') {
    const [page, ...hash] = url.hash.slice('#browser.'.length).toLowerCase().split('-')
    return `/config/browser/${page}${hash.length ? `#${[page, ...hash].join('-')}` : ''}`
  }
}

export default {
  extends: VitestTheme as unknown as any,
  enhanceApp({ app }) {
    app.component('Version', Version)
    app.component('CRoot', CRoot)
    app.component('Experimental', Experimental)
    app.component('Deprecated', Deprecated)
    app.component('Advanced', Advanced)
    app.component('CourseLink', CourseLink)
    app.use(TwoslashFloatingVue)
    enhanceAppWithTabs(app)
  },
} satisfies Theme
