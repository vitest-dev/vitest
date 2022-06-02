import 'uno.css'
import { inBrowser } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import '../../main.css'
import '../../style/vars.css'

if (inBrowser)
  import('./pwa')

export default DefaultTheme
