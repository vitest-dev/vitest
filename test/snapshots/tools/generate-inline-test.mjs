import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import pathe from 'pathe'

const dirname = pathe.dirname(fileURLToPath(import.meta.url))

export async function generateInlineTest(templatePath, testpath) {
  const template = await fs.readFile(templatePath, 'utf8')
  await fs.writeFile(testpath, template)
  console.log(`Generated ${testpath}`)
}

const filepath = pathe.resolve(dirname, '../test-update/snapshots-inline-js.test.js')
const template = pathe.resolve(dirname, './inline-test-template.js');

(async () => {
  await generateInlineTest(template, filepath)
})()
