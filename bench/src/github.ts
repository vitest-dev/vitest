// Base code is from https://github.com/antfu/export-size-action

import type { Context } from '@actions/github/lib/context'
import type { WebhookPayload } from '@actions/github/lib/interfaces'

import { markdownTable as table } from 'markdown-table'
import { setFailed } from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { exec } from '@actions/exec'

import type { Result } from './bench'
import { runBench } from './bench'

type GitHub = ReturnType<typeof getOctokit>
type Repo = Context['repo']
type Pull = WebhookPayload['pull_request']

const COMMNET_HEADING = '## [Benchmark]'

async function fetchPreviousComment(
  octokit: GitHub,
  repo: { owner: string; repo: string },
  pr: { number: number },
) {
  const { data: commnets } = await octokit.rest.issues.listComments(
    {
      ...repo,
      issue_number: pr.number,
    },
  )

  return commnets.find(comment => comment.body.startsWith(COMMNET_HEADING))
}

const token = process.env.GITHUB_TOKEN // getInput('github_token')

export async function buildAndGetTime(branch: string | null): Promise<Result[]> {
  if (branch) {
    try {
      await exec(`git fetch origin ${branch} --depth=1`)
    }
    catch (error) {
      // eslint-disable-next-line no-console
      console.log('Fetch failed', error.message)
    }

    await exec(`git checkout -f ${branch}`)
  }

  await exec('npx -p @antfu/ni nci', [], { cwd: '..' })

  await exec('npx -p @antfu/ni nr build', [], { cwd: '..' })

  await exec('npx -p @antfu/ni nci', [])

  return new Promise(runBench)
}

function formatCompareTable(base: Result[], current: Result[]): string {
  let body = ''

  const results = base
    .map((res) => {
      const cRes = current.find(i => i.name === res.name)

      const currentTime = cRes?.mean ?? 0
      const delta = res.mean - currentTime
      const deltaPercent = currentTime === 0 ? 1 : delta / currentTime

      return {
        name: res.name,
        baseTime: res.mean,
        rme: cRes.rme,
        currentTime,
        delta,
        deltaPercent,
      }
    })

  body += table(
    [
      ['Name', 'Time'],
      ...results
        .map(({
          name,
          currentTime,
          baseTime,
          rme,
          deltaPercent,
        }) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const deltaPercentStr = deltaPercent === 0
            ? ''
            : deltaPercent > 0
              ? `+${(deltaPercent * 100).toFixed(2)}% ${baseTime !== 0 ? '🔺' : '➕'}`
              : `${(deltaPercent * 100).toFixed(2)}% 🔽`

          return [name, `${currentTime.toFixed(3)}s ± ${rme.toFixed(2)}%`]
        }),
    ],
    { align: ['l', 'r', 'l'] },
  )

  // eslint-disable-next-line no-console
  console.log(body)

  return `${body}`
}

async function compareToRef(ref: string, pr?: Pull, repo?: Repo) {
  let body = `${COMMNET_HEADING}\n\n`

  const base = await buildAndGetTime(null)
  // TODO: Extract this to a GitHub action to allow comparing benchmarks
  // const current = await buildAndGetTime(ref)

  body += formatCompareTable(base, base)

  if (pr && repo) {
    const octokit = getOctokit(token)

    let comment = await fetchPreviousComment(octokit, repo, pr)
    comment = null

    try {
      if (!comment) {
        await octokit.rest.issues.createComment({
          ...repo,
          issue_number: pr.number,
          body,
        })
      }
      else {
        await octokit.rest.issues.updateComment({
          ...repo,
          comment_id: comment.id,
          body,
        })
      }
    }
    catch (error) {
      console.error(error)
      console.error(
        'Error creating/updating comment. This can happen for PR\'s originating from a fork without write permissions.',
      )
    }
  }
}

async function run() {
  const pr = context.payload?.issue?.pull_request

  try {
    if (pr)
      await compareToRef(pr.base.ref as string, pr, context.repo)
    else
      await compareToRef('HEAD^')
  }
  catch (error) {
    console.error(error)
    setFailed(error)
  }
}

run()
