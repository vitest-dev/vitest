/* eslint-disable no-console */
import { a } from './a'

// used to check if the process is still working
// using once instead of attempting to use hmr, a separate test specific for hmr should check for that
process.stdin.once('data', () => {
  console.log(`Received result from a() "${a()}"`)
})

console.log('Running')
