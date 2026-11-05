import { inChild } from './worker-and-process.js'

process.send({ result: inChild() })
