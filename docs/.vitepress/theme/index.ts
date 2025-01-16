import type { Theme } from 'vitepress'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import { inBrowser } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client'
import { h } from 'vue'
import HomePage from '../components/HomePage.vue'
import Version from '../components/Version.vue'
import '../style/main.css'
import '../style/vars.css'
import 'uno.css'
import '@shikijs/vitepress-twoslash/style.css'

if (inBrowser) {
  import('./pwa')
}

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-features-after': () => h(HomePage),
      'layout-top': () => h(OldDocument),
    })
  },
  enhanceApp({ app }) {
    app.component('Version', Version)
    app.use(TwoslashFloatingVue)
    enhanceAppWithTabs(app)
  },
} satisfies Theme
