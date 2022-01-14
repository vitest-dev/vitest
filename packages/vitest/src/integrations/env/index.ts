import node from './node'
import jsdom from './jsdom'
import happy from './happy-dom'

export const environments = {
  node,
  jsdom,
  'happy-dom': happy,
}
