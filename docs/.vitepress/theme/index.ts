import { h } from 'vue'
import Theme, { VPBadge } from 'vitepress/theme'
import type { EnhanceAppContext } from 'vitepress'
import { inBrowser } from 'vitepress'
import '../style/main.css'
import '../style/vars.css'
import 'uno.css'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import HomePage from '../components/HomePage.vue'
import Version from '../components/Version.vue'
import '@shikijs/vitepress-twoslash/style.css'

if (inBrowser) {
  import('./pwa')
}

export default {
  ...Theme,
  Layout() {
    return h(Theme.Layout, null, {
      'home-features-after': () => h(HomePage),
    })
  },
  enhanceApp({ app }: EnhanceAppContext) {
    // Vitepress v1+ doesn't seem to expose it as a global "Badge"
    app.component('Badge', VPBadge)
    app.component('Version', Version)
    app.use(TwoslashFloatingVue as any)
  },
}
