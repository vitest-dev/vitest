/* eslint-disable no-console */
import { a } from './testMod'

console.log('[main.js] load!')
console.log('[main.js] hello world')
console.log('[main.js]', a)

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log('[main.ts] hot reload!')
  })
}
