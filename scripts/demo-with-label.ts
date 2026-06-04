// pnpm dlx tsx scripts/demo-with-label.ts
import { withLabel } from '../packages/vitest/src/node/reporters/renderers/utils.ts'

console.log(withLabel('red', 'ERROR', 'This is an error message'))
console.log(withLabel('green', 'SUCCESS', 'This is a success message'))
console.log(withLabel('blue', 'INFO', 'This is an info message'))
console.log(withLabel('cyan', 'DEBUG', 'This is a debug message'))
console.log(withLabel('yellow', 'WARNING', 'This is a warning message'))
