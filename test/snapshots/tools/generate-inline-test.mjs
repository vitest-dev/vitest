import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'

const dir = dirname(fileURLToPath(import.meta.url))

export async function generateInlineTest(templatePath, testPath) {
  const template = await fs.readFile(templatePath, 'utf8')
  await fs.writeFile(testPath, template)
  console.warn(`Generated ${testPath}`)
}

const filepath = resolve(dir, '../test-update/snapshots-inline-js.test.js')
const template = resolve(dir, './inline-test-template.js');

(async () => {
  await generateInlineTest(template, filepath)
  await generateInlineTest(
    resolve(dir, './inline-test-template-concurrent.js'),
    resolve(dir, '../test-update/inline-test-template-concurrent.test.js'),
  )
})()
