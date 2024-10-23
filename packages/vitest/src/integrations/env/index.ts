import edge from './edge-runtime'
import happy from './happy-dom'
import jsdom from './jsdom'
import node from './node'

export const environments = {
  node,
  jsdom,
  'happy-dom': happy,
  'edge-runtime': edge,
}

export const envs = Object.keys(environments)
