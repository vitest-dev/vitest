import { execSync } from 'child_process'
import fs from 'fs/promises'

await fs.copyFile('README.md', 'README.gh.md')
await fs.unlink('README.md')
await fs.copyFile('README.npm.md', 'README.md')

execSync('npm publish', { stdio: 'inherit' })

await fs.unlink('README.md')
await fs.copyFile('README.gh.md', 'README.md')
await fs.unlink('README.gh.md')
