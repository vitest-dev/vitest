import { promises as fs } from 'node:fs'
import { ofetch } from 'ofetch'

interface Contributor {
  login: string
}

async function fetchContributors(page = 1) {
  const collaborators: string[] = []
  const data = await ofetch<Contributor[]>(`/repos/vitest-dev/vitest/contributors`, {
    method: 'get',
    baseURL: 'https://api.github.com',
    params: {
      per_page: 100,
      page,
    },
    headers: {
      'content-type': 'application/json',
    },
  }) || []
  collaborators.push(...data.map(i => i.login))
  if (data.length === 100)
    collaborators.push(...(await fetchContributors(page + 1)))
  return collaborators.filter(name => !name.includes('[bot]'))
}

async function generate() {
  const collaborators = await fetchContributors()
  await fs.writeFile('./docs/.vitepress/contributor-names.json', `${JSON.stringify(collaborators, null, 2)}\n`, 'utf8')
}

generate()
