import { promises as fs } from 'fs'
import fetch from 'node-fetch'

interface Contributor {
  login: string
  avatar_url?: string
}

async function fetchContributors() {
  const collaborators: string[][] = []
  const res = await fetch('https://api.github.com/repos/vitest-dev/vitest/contributors', {
    method: 'get',
    headers: {
      'content-type': 'application/json',
    },
  })
  const data = await res.json() as Contributor[] || []
  collaborators.push(...data.map(({ login, avatar_url }) => {
    // optimize the avatar size: check avatar and contributors components
    if (avatar_url)
      return [login, `${avatar_url}${avatar_url.includes('?') ? '&' : '?'}s=`]

    return [login, `https://github.com/${login}.png?size=`]
  }))
  return collaborators
}

async function generate() {
  const collaborators = await fetchContributors()
  await fs.writeFile('./docs/contributors.json', JSON.stringify(collaborators, null, 2), 'utf8')
}

generate()
