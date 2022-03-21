import { createApp } from 'vue'
import { directives, plugins } from './global-setup'
import App from './App.vue'

const app = createApp(App)

plugins.forEach((plugin) => {
  app.use(plugin)
})

Object.entries(directives).forEach(([name, directive]) => {
  app.directive(name, directive)
})

app.mount('#app')
