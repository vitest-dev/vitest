import { promises as fs } from 'fs'
import fetch from 'node-fetch'

const { GITHUB_TOKEN: token } = process.env

type Contributor = {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
  contributions: number;
};

async function fetchContributors() {
  const collaborators: string[] = []
  const res = await fetch('https://api.github.com/repos/antfu-sponsors/vitest/contributors', {
    method: 'get',
    headers: {
      'authorization': `bearer ${token}`,
      'content-type': 'application/json',
    },
  })
  const data = await res.json() as Contributor[];
  collaborators.push(...data.map((i) => i.login))
  return collaborators
}

async function generate() {
  const collaborators = await fetchContributors()
  await fs.writeFile('./docs/contributors.json', JSON.stringify(collaborators, null, 2), 'utf8')
}

generate()
