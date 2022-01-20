import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import routes from 'virtual:generated-pages'
import tooltip from './directives/tooltip'
import App from './App.vue'

import 'd3-graph-controller/default.css'
import 'splitpanes/dist/splitpanes.css'
import '@unocss/reset/tailwind.css'
import 'codemirror/lib/codemirror.css'
import 'codemirror-theme-vars/base.css'
import 'tippy.js/dist/tippy.css'
import './styles/main.css'
import 'uno.css'

const app = createApp(App)
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
app.use(router)
app.directive('tooltip', tooltip)
app.mount('#app')
