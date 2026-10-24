import type { Key } from 'node:readline'

export function isCancelAction(str: string, key: Key): boolean {
  return str === '\x03' || str === '\x1B' || (!!key && key.ctrl === true && key.name === 'c')
}
