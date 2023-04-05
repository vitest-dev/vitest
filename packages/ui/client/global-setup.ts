/// <reference types="vite-plugin-pages/client" />

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
import { BASE_PATH } from './constants'

export const directives = {
  tooltip: VTooltip,
}

FloatingVue.options.instantMove = true
FloatingVue.options.distance = 10

export function createRouter() {
  return _createRouter({
    history: createWebHistory(BASE_PATH),
    routes,
  })
}

export const plugins = [createRouter]
