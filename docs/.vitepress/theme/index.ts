import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { inBrowser } from 'vitepress'
import '../style/main.css'
import '../style/vars.css'
import 'uno.css'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import HomePage from '../components/HomePage.vue'
import Version from '../components/Version.vue'
import AsideViteConf from '../components/AsideViteConf.vue'
import '@shikijs/vitepress-twoslash/style.css'

if (inBrowser) {
  import('./pwa')
}

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-features-after': () => h(HomePage),
      'aside-ads-before': () => h(AsideViteConf),
    })
  },
  enhanceApp({ app }) {
    app.component('Version', Version)
    app.use(TwoslashFloatingVue)
  },
} satisfies Theme
