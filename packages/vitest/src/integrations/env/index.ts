import type { Environment } from '../../types/environment'
import edge from './edge-runtime'
import happy from './happy-dom'
import jsdom from './jsdom'
import node from './node'

export const environments: {
  'node': Environment
  'jsdom': Environment
  'happy-dom': Environment
  'edge-runtime': Environment
} = {
  node,
  jsdom,
  'happy-dom': happy,
  'edge-runtime': edge,
}

export const envs: string[] = Object.keys(environments)
