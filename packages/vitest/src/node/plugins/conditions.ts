import * as vite from 'vite'

type Vite6Options = typeof vite & Partial<{
  defaultServerConditions?: string[]
}>

/**
 * In Vite 6+, providing a value for resolve.conditions overrides the defaults
 * In Vite 5, passing ["node"] will be merged with the defaults
 *
 * @returns the appropriate conditions array depending on the vite version
 *
 */
export function getDefaultServerConditions() {
  return (vite as Vite6Options).defaultServerConditions ?? ['node']
}
