import { promises as fs } from 'node:fs'

interface Contributor {
  login: string
}

async function fetchContributors(page = 1) {
  const collaborators: string[] = []
  const data = await (await fetch(`https://api.github.com/repos/vitest-dev/vitest/contributors?per_page=100&page=${page}`, {
    headers: {
      'content-type': 'application/json',
    },
  })).json() as Contributor[] || []
  collaborators.push(...data.map(i => i.login))
  if (data.length === 100) {
    collaborators.push(...(await fetchContributors(page + 1)))
  }
  return collaborators.filter(name => !name.includes('[bot]'))
}

async function generate() {
  const collaborators = await fetchContributors()
  await fs.writeFile('./docs/.vitepress/contributor-names.json', `${JSON.stringify(collaborators, null, 2)}\n`, 'utf8')
}

generate()
