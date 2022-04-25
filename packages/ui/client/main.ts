import { createApp } from 'vue'
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
