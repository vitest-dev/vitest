import fs from 'fs-extra'
import { $fetch } from 'ohmyfetch'

const pathContributors = '../docs/contributors.json'
const dirAvatars = '../docs/public/user-avatars/'

let contributors: string[] = []

async function generate() {
  await fs.ensureDir(dirAvatars)
  contributors = JSON.parse(await fs.readFile(pathContributors, { encoding: 'utf-8' }))

  await Promise.all(contributors.map(async(name) => {
    const image = await $fetch(`https://github.com/${name}.png`, { responseType: 'arrayBuffer' })
    fs.writeFile(`${dirAvatars}${name}.png`, Buffer.from(image))
  }))
}

generate()
