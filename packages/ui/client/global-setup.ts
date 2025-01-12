/// <reference types="vite-plugin-pages/client" />

import type { Directive } from 'vue'
import FloatingVue, { vTooltip } from 'floating-vue'
import routes from 'virtual:generated-pages'
import {
  createRouter as _createRouter,
  createWebHashHistory,
} from 'vue-router'
import 'd3-graph-controller/default.css'
import 'splitpanes/dist/splitpanes.css'
import '@unocss/reset/tailwind.css'
import 'codemirror/lib/codemirror.css'
import 'codemirror-theme-vars/base.css'
import './styles/main.css'
import 'floating-vue/dist/style.css'
import 'uno.css'

export const directives: Record<string, Directive> = {
  tooltip: vTooltip,
}

FloatingVue.options.instantMove = true
FloatingVue.options.distance = 10

export function createRouter() {
  return _createRouter({
    history: createWebHashHistory(),
    routes,
  })
}

export const plugins = [createRouter]
