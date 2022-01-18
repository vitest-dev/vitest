import tippy from 'tippy.js'
import type { Directive } from 'vue'
import type { Instance, Placement, Props } from 'tippy.js'

const getTippyInstance = (el: Element, instanceCallback: (instance?: Instance) => void): void => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  instanceCallback('_tippy' in el ? el._tippy as Instance : undefined)
}

const tooltip: Directive = (el: Element, { value, oldValue, modifiers }) => {
  const config: Partial<Props> = {
    content: value,
    placement: Object.keys(modifiers).at(0) as unknown as Placement,
  }
  getTippyInstance(el, (instance) => {
    instance === undefined // mount if instance not yet created, else update content
      ? tippy(el, {
        delay: 200,
        hideOnClick: false,
        ...config,
      })
      : value !== oldValue && instance.setProps(config)
  })
}
export default tooltip
