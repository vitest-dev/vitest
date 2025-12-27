import type { Theme } from 'vitepress'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import { inBrowser } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client'
import { h } from 'vue'
import HomePage from '../components/HomePage.vue'
import Version from '../components/Version.vue'
import CRoot from '../components/CRoot.vue'
import Deprecated from '../components/Deprecated.vue'
import Experimental from '../components/Experimental.vue'
import Advanced from '../components/Advanced.vue'
import CourseLink from '../components/CourseLink.vue'
import '../style/main.css'
import '../style/vars.css'
import 'uno.css'
import '@shikijs/vitepress-twoslash/style.css'
import 'virtual:group-icons.css'

if (inBrowser) {
  import('./pwa')
}

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-features-after': () => h(HomePage),
    })
  },
  enhanceApp({ app, router }) {
    router.onBeforeRouteChange = (to) => {
      if (typeof location === 'undefined') {
        return true
      }
      const url = new URL(to, location.href)
      if (!url.hash) {
        return true
      }
      if (url.pathname === '/config' || url.pathname === '/config/' || url.pathname === '/config.html') {
        const [page, ...hash] = (url.hash.startsWith('#browser.') ? url.hash.slice(9) : url.hash.slice(1)).toLowerCase().split('-')
        setTimeout(() => { router.go(`/config/${page}${hash.length ? `#${[page, ...hash].join('-')}` : ''}`) })
        return false
      }
      if (url.pathname === '/guide/browser/config' || url.pathname === '/guide/browser/config/' || url.pathname === '/guide/browser/config.html') {
        const [page, ...hash] = url.hash.slice('#browser.'.length).toLowerCase().split('-')
        setTimeout(() => { router.go(`/config/browser/${page}${hash.length ? `#${[page, ...hash].join('-')}` : ''}`) })
        return false
      }
    }
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
