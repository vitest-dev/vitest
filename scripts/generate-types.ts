import fs from 'fs/promises'
import { globalApis } from '../src/constants'

await fs.writeFile('global.d.ts', `declare global {\n${globalApis.map(i => `  const ${i}: typeof import('vitest')['${i}']`).join('\n')}\n}\nexport {}\n`, 'utf-8')
