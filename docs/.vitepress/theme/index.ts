import 'uno.css'
import { inBrowser } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import '../../main.css'

if (inBrowser)
  import('./pwa')

export default DefaultTheme
