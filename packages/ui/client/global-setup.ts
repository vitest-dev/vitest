import { createRouter as _createRouter, createWebHistory } from 'vue-router'
import FloatingVue, { VTooltip } from 'floating-vue'
import routes from 'virtual:generated-pages'
import 'd3-graph-controller/default.css'
import 'splitpanes/dist/splitpanes.css'
import '@unocss/reset/tailwind.css'
import 'codemirror/lib/codemirror.css'
import 'codemirror-theme-vars/base.css'
import './styles/main.css'
import 'floating-vue/dist/style.css'
import 'uno.css'

export const directives = {
  tooltip: VTooltip,
}

FloatingVue.options.instantMove = true
FloatingVue.options.distance = 10

export const createRouter = () => _createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export const plugins = [createRouter]
