import { existsSync, promises as fsp } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'pathe'

const docsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const pathContributors = resolve(docsDir, '.vitepress/contributor-names.json')
const dirAvatars = resolve(docsDir, 'public/user-avatars/')
const dirSponsors = resolve(docsDir, 'public/sponsors/')

let contributors: string[] = []

async function download(url: string, fileName: string) {
  if (existsSync(fileName))
    return
  // eslint-disable-next-line no-console
  console.log('downloading', fileName)
  try {
    const image = await (await fetch(url)).arrayBuffer()
    await fsp.writeFile(fileName, Buffer.from(image))
  }
  catch {}
}

async function fetchAvatars() {
  if (!existsSync(dirAvatars))
    await fsp.mkdir(dirAvatars, { recursive: true })
  contributors = JSON.parse(await fsp.readFile(pathContributors, { encoding: 'utf-8' }))

  await Promise.all(contributors.map(name => download(`https://github.com/${name}.png?size=100`, join(dirAvatars, `${name}.png`))))
}

async function fetchSponsors() {
  if (!existsSync(dirSponsors))
    await fsp.mkdir(dirSponsors, { recursive: true })
  await Promise.all([
    download('https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg', join(dirSponsors, 'antfu.svg')),
    download('https://cdn.jsdelivr.net/gh/patak-dev/static/sponsors.svg', join(dirSponsors, 'patak-dev.svg')),
    download('https://cdn.jsdelivr.net/gh/sheremet-va/static/sponsors.svg', join(dirSponsors, 'sheremet-va.svg')),
  ])
}

fetchAvatars()
fetchSponsors()
