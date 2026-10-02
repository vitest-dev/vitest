const MARKER = '<!-- vitest-pr-redirect -->'

function createRedirect({ github, context, core }) {
  const { owner, repo } = context.repo
  const policyUrl = `https://github.com/${owner}/${repo}/blob/main/CONTRIBUTING.md#pull-request-policy`

  // a missing list fails the run, an empty list would close the PRs of every approved contributor
  async function readApprovedContributors() {
    const { data: file } = await github.rest.repos.getContent({
      owner,
      repo,
      path: 'APPROVED_CONTRIBUTORS',
      // the full name, a tag with the same name must not replace the branch
      ref: 'refs/heads/approved-contributors',
    })
    const ids = new Set()
    for (const line of Buffer.from(file.content, 'base64').toString('utf8').split('\n')) {
      // the login after `#` is only for readers, another account can take a login after a rename
      const id = /^(\d+)(?: *#.*)?$/.exec(line.trim())?.[1]
      if (id) {
        ids.add(Number(id))
      }
    }
    return ids
  }

  const writeAccess = new Map()
  async function hasWriteAccess(username) {
    if (!writeAccess.has(username)) {
      const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
        owner,
        repo,
        username,
      })
      writeAccess.set(username, ['admin', 'write'].includes(data.permission))
    }
    return writeAccess.get(username)
  }

  async function findReasonToSkip(pr, approved) {
    // anyone can open a PR between two branches of this repository, only an installed app is trusted here
    if (pr.head.repo?.full_name === `${owner}/${repo}` && pr.user.type === 'Bot') {
      return 'opened by an app from a branch in this repository'
    }
    if (
      ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(pr.author_association) ||
      (await hasWriteAccess(pr.user.login))
    ) {
      return 'the author is a team member'
    }
    if (approved.has(pr.user.id)) {
      return 'the author is an approved contributor'
    }
    return null
  }

  async function findLinkedIssues(pr) {
    const { repository } = await github.graphql(
      `query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            closingIssuesReferences(first: 10) {
              nodes {
                number
                repository { nameWithOwner }
              }
            }
          }
        }
      }`,
      { owner, repo, number: pr.number },
    )
    return repository.pullRequest.closingIssuesReferences.nodes.filter(
      (issue) =>
        // closing keywords can point to any repository
        issue?.repository.nameWithOwner.toLowerCase() === `${owner}/${repo}`.toLowerCase(),
    )
  }

  async function wasRedirected(pr) {
    const comments = await github.paginate(github.rest.issues.listComments, {
      owner,
      repo,
      issue_number: pr.number,
      per_page: 100,
    })
    return comments.some(
      (comment) => comment.user?.login === 'github-actions[bot]' && comment.body?.includes(MARKER),
    )
  }

  async function close(pr, { comment }) {
    if (comment) {
      const issues = await findLinkedIssues(pr)
      const nextStep = issues.length
        ? `Please keep the discussion in ${issues.map((issue) => `#${issue.number}`).join(', ')}.`
        : `If there is no issue for this change yet, please [open one](https://github.com/${owner}/${repo}/issues/new/choose) to discuss it with the team first.`
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: pr.number,
        body: [
          MARKER,
          `Hello @${pr.user.login}. Thank you for taking the time to contribute!`,
          '',
          'Unfortunately, the team accepts pull requests only from maintainers and approved contributors, so this pull request was closed automatically. We are sorry about that, it is not a judgement of your work. The number of pull requests grew beyond what the team can review, and this policy gives maintainers the space to triage and prioritize issues at their own pace.',
          '',
          `${nextStep} Your changes are not lost: a maintainer can reopen this pull request if the team decides to go forward with it. See our [pull request policy](${policyUrl}) for more context.`,
        ].join('\n'),
      })
    }
    await github.rest.pulls.update({ owner, repo, pull_number: pr.number, state: 'closed' })
    core.info(`#${pr.number} by @${pr.user.login} is closed`)
  }

  return { readApprovedContributors, hasWriteAccess, findReasonToSkip, wasRedirected, close }
}

/**
 * Closes a pull request that does not follow the "Pull Request Policy" in CONTRIBUTING.md
 * and asks the author to discuss the change in an issue.
 */
export default async function redirectPullRequest({ github, context, core }) {
  const redirect = createRedirect({ github, context, core })
  const pr = context.payload.pull_request

  const approved = await redirect.readApprovedContributors()
  let reason = await redirect.findReasonToSkip(pr, approved)
  if (
    !reason &&
    context.payload.action === 'reopened' &&
    (await redirect.hasWriteAccess(context.payload.sender.login))
  ) {
    reason = 'a maintainer reopened it'
  }
  if (reason) {
    core.info(`#${pr.number} is skipped: ${reason}`)
    return
  }
  // a PR reopened by its author is closed again without a second comment
  await redirect.close(pr, { comment: !(await redirect.wasRedirected(pr)) })
}

/**
 * Closes every open pull request that does not follow the "Pull Request Policy" in CONTRIBUTING.md.
 */
export async function redirectOpenPullRequests({ github, context, core }) {
  const redirect = createRedirect({ github, context, core })
  const { owner, repo } = context.repo
  const dryRun = process.env.DRY_RUN === 'true'

  const approved = await redirect.readApprovedContributors()
  const pulls = await github.paginate(github.rest.pulls.list, {
    owner,
    repo,
    state: 'open',
    sort: 'created',
    direction: 'asc',
    per_page: 100,
  })

  let closed = 0
  let failures = 0
  for (const pr of pulls) {
    // a PR that cannot be processed stays open and must not block the other PRs
    try {
      let reason = await redirect.findReasonToSkip(pr, approved)
      // the event workflow closes a PR reopened by its author, so only a maintainer could reopen it
      if (!reason && (await redirect.wasRedirected(pr))) {
        reason = 'a maintainer reopened it'
      }
      if (reason) {
        core.info(`#${pr.number} is skipped: ${reason}`)
        continue
      }
      closed++
      if (dryRun) {
        core.info(`#${pr.number} by @${pr.user.login} would be closed`)
        continue
      }
      await redirect.close(pr, { comment: true })
      // GitHub limits how fast a token can create content
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (error) {
      failures++
      core.error(`#${pr.number} failed: ${error.message}`)
    }
  }
  core.notice(`${dryRun ? 'Would close' : 'Closed'} ${closed} of ${pulls.length} open PRs`)
  if (failures) {
    core.setFailed(`Cannot process ${failures} PRs`)
  }
}
