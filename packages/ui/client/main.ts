// import { Splitpanes, Pane } from 'splitpanes'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import routes from 'virtual:generated-pages'
import App from './App.vue'

import 'd3-graph-controller/default.css'
import 'uno.css'
import '@unocss/reset/tailwind.css'
import 'codemirror/lib/codemirror.css'
import 'codemirror-theme-vars/base.css'
import 'splitpanes/dist/splitpanes.css'
import './styles/main.css'

const app = createApp(App)
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
app.use(router)
// app.component('Splitpanes', Splitpanes)
// app.component('Pane', Pane)
app.mount('#app')
