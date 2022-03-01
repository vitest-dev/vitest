import { promises as fs } from 'fs'
import fetch from 'node-fetch'

interface Contributor {
  login: string
}

async function fetchContributors() {
  const collaborators: string[] = []
  const res = await fetch('https://api.github.com/repos/vitest-dev/vitest/contributors', {
    method: 'get',
    headers: {
      'content-type': 'application/json',
    },
  })
  const data = await res.json() as Contributor[] || []
  collaborators.push(...data.map(i => i.login))
  return collaborators
}

async function generate() {
  const collaborators = await fetchContributors()
  await fs.writeFile('./docs/contributors.json', JSON.stringify(collaborators, null, 2), 'utf8')
}

generate()
