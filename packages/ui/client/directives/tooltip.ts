import tippy from 'tippy.js'
import type { Directive, FunctionDirective } from 'vue'
import type { Instance, Placement } from 'tippy.js'

const getTippyInstance = (el: Element, instanceCallback: (instance: Instance) => void): void => {
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
  const instance = '_tippy' in el ? el._tippy as Instance : undefined
  if (instance) instanceCallback(instance)
}

const tippyMount: FunctionDirective = (el: Element, { value, modifiers }) => {
  tippy(el, {
    content: value,
    delay: 200,
    hideOnClick: false,
    placement: Object.keys(modifiers).at(0) as unknown as Placement,
  })
}

const tooltip: Directive = {
  mounted: tippyMount,
  updated(el: Element, { value, oldValue }) {
    getTippyInstance(el, instance => value !== oldValue && instance.setContent(value))
  },
}

export default tooltip
