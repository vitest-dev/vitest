import tippy from 'tippy.js'
import type { Directive } from 'vue'
import type { Placement } from 'tippy.js'

const tooltip: Directive = (el, { value, modifiers }) => {
  tippy(el, {
    content: value,
    placement: Object.keys(modifiers).at(0) as unknown as Placement,
  })
}

export default tooltip
