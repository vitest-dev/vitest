import { h } from 'vue'
import Theme from 'vitepress/theme'
import { inBrowser } from 'vitepress'
import '../style/main.css'
import '../style/vars.css'
import 'uno.css'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import HomePage from '../components/HomePage.vue'
import '@shikijs/vitepress-twoslash/style.css'

if (inBrowser)
  import('./pwa')

export default {
  ...Theme,
  Layout() {
    return h(Theme.Layout, null, {
      'home-features-after': () => h(HomePage),
    })
  },
  // @ts-expect-error - I'm not sure if it's a problem with my local environment. The imported module failed to automatically load the type.
  enhanceApp({ app }) {
    app.use(TwoslashFloatingVue)
  },
}
