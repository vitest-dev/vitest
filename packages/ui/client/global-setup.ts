import { createRouter as _createRouter, createWebHistory } from 'vue-router'
import routes from 'virtual:generated-pages'
import tooltip from './directives/tooltip'
import 'd3-graph-controller/default.css'
import 'splitpanes/dist/splitpanes.css'
import '@unocss/reset/tailwind.css'
import 'codemirror/lib/codemirror.css'
import 'codemirror-theme-vars/base.css'
import 'tippy.js/dist/tippy.css'
import './styles/main.css'
import 'uno.css'

export const directives = {
  tooltip,
}

export const createRouter = () => _createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export const plugins = [createRouter]
