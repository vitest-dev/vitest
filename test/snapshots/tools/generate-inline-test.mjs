import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'

const dir = dirname(fileURLToPath(import.meta.url))

export async function generateInlineTest(templatePath, testPath) {
  const template = await fs.readFile(templatePath, 'utf8')
  await fs.writeFile(testPath, template)
  console.warn(`Generated ${testPath}`)
}

const filepath1 = resolve(dir, '../test-update/snapshots-inline-js.test.js')
const template1 = resolve(dir, './inline-test-template.js')
const filepath2 = resolve(dir, '../test-update/snapshots-inline-concurrent-js.test.js')
const template2 = resolve(dir, './inline-test-template-concurrent.js');

(async () => {
  await Promise.all([
    generateInlineTest(template1, filepath1),
    generateInlineTest(template2, filepath2),
  ])
})()
