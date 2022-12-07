import { createApp } from 'vue'
import { version } from '../package.json'
import App from './App.vue'
import { directives, plugins } from './global-setup'

const app = createApp(App)

plugins.forEach((plugin) => {
  app.use(plugin())
})

Object.entries(directives).forEach(([name, directive]) => {
  app.directive(name, directive)
})

app.mount('#app')

document.querySelector('#app')?.setAttribute('app-version', version)
