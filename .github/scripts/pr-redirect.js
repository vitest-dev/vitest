// maintainers need time to react, and the author needs time to link an issue
const MIN_AGE_MS = 24 * 60 * 60 * 1000
// PRs opened before the policy was introduced stay open
const POLICY_START = Date.parse('2026-10-01T00:00:00Z')
// limits the damage if one of the checks below is ever wrong
const MAX_REDIRECTS = 20
const DISCUSSION_CATEGORY = 'ideas'
const MARKER = '<!-- vitest-pr-redirect -->'

/**
 * Closes pull requests that do not follow the "Pull Request Policy" in CONTRIBUTING.md
 * and opens a discussion for each of them.
 */
export default async function redirectPullRequests({ github, context, core }) {
  const { owner, repo } = context.repo
  const dryRun = process.env.DRY_RUN === 'true'
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

  async function hasMaintainerReaction(pr) {
    const reactions = await github.paginate(github.rest.reactions.listForIssue, {
      owner,
      repo,
      issue_number: pr.number,
      content: 'eyes',
      per_page: 100,
    })
    for (const reaction of reactions) {
      if (reaction.user && (await hasWriteAccess(reaction.user.login))) {
        return true
      }
    }
    return false
  }

  async function resolvesOwnIssue(pr) {
    const { repository } = await github.graphql(
      `query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            closingIssuesReferences(first: 50) {
              nodes {
                state
                author { login }
                repository { nameWithOwner }
              }
            }
          }
        }
      }`,
      { owner, repo, number: pr.number },
    )
    const author = pr.user.login.toLowerCase()
    return repository.pullRequest.closingIssuesReferences.nodes.some(
      (issue) =>
        issue?.state === 'OPEN' &&
        // closing keywords can point to any repository
        issue.repository.nameWithOwner.toLowerCase() === `${owner}/${repo}`.toLowerCase() &&
        issue.author?.login.toLowerCase() === author,
    )
  }

  async function findReasonToSkip(pr, approved) {
    const createdAt = Date.parse(pr.created_at)
    if (createdAt < POLICY_START) {
      return 'opened before the policy was introduced'
    }
    if (Date.now() - createdAt < MIN_AGE_MS) {
      return 'opened less than a day ago'
    }
    // anyone can open a PR between two branches of this repository, only an installed app is trusted here
    if (pr.head.repo?.full_name === `${owner}/${repo}` && pr.user.type === 'Bot') {
      return 'opened by an app from a branch in this repository'
    }
    if (approved.has(pr.user.id)) {
      return 'the author is an approved contributor'
    }
    if (
      ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(pr.author_association) ||
      (await hasWriteAccess(pr.user.login))
    ) {
      return 'the author is a team member'
    }
    if (await hasMaintainerReaction(pr)) {
      return 'a maintainer reacted with 👀'
    }
    if (await resolvesOwnIssue(pr)) {
      return 'resolves an issue opened by the author'
    }
    const { data: current } = await github.rest.pulls.get({ owner, repo, pull_number: pr.number })
    if (current.state !== 'open') {
      return 'closed during the run'
    }
    return null
  }

  async function redirect(pr, repositoryId, categoryId) {
    const comments = await github.paginate(github.rest.issues.listComments, {
      owner,
      repo,
      issue_number: pr.number,
      per_page: 100,
    })
    // a reopened PR is closed again, but it does not get a second discussion
    const redirected = comments.some(
      (comment) => comment.user?.login === 'github-actions[bot]' && comment.body?.includes(MARKER),
    )
    if (!redirected) {
      const link = `[#${pr.number}](${pr.html_url})`
      const description = (pr.body || '')
        .trim()
        // a zero-width space after `@`, so the copy does not notify the mentioned users again
        .replaceAll('@', '@​')
        // a discussion over 65536 characters is rejected, and then the PR stays open
        .slice(0, 60000)
        .toWellFormed()
      const { createDiscussion } = await github.graphql(
        `mutation ($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
          createDiscussion(
            input: { repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body }
          ) {
            discussion { url }
          }
        }`,
        {
          repositoryId,
          categoryId,
          title: pr.title,
          body: [
            `> _Originally proposed by @${pr.user.login} in ${link}. Their description is reproduced below._`,
            '>',
            `> _Pull requests from the community are converted to discussions automatically, where they can be triaged and prioritized. See the [pull request policy](${policyUrl})._`,
            '',
            description || '_(no description)_',
            '',
            '---',
            '',
            `Original implementation from ${link} by @${pr.user.login}`,
          ].join('\n'),
        },
      )
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: pr.number,
        body: [
          MARKER,
          `Hello @${pr.user.login}. Thank you for the contribution!`,
          '',
          `To keep the review queue manageable, a pull request stays open only if it comes from an approved contributor or resolves an issue opened by its author. This pull request was closed automatically and moved to a discussion: ${createDiscussion.discussion.url}`,
          '',
          `Your changes are not lost. The discussion links back to this pull request, and a maintainer can reopen it if the team decides to go forward with the change. See our [pull request policy](${policyUrl}) for more context.`,
        ].join('\n'),
      })
    }
    await github.rest.pulls.update({ owner, repo, pull_number: pr.number, state: 'closed' })
  }

  const approved = await readApprovedContributors()
  const { repository } = await github.graphql(
    `query ($owner: String!, $repo: String!, $slug: String!) {
      repository(owner: $owner, name: $repo) {
        id
        discussionCategory(slug: $slug) { id }
      }
    }`,
    { owner, repo, slug: DISCUSSION_CATEGORY },
  )
  const pulls = await github.paginate(github.rest.pulls.list, {
    owner,
    repo,
    state: 'open',
    sort: 'created',
    direction: 'asc',
    per_page: 100,
  })

  let redirects = 0
  let failures = 0
  for (const pr of pulls) {
    if (redirects === MAX_REDIRECTS) {
      core.warning(
        `Reached the limit of ${MAX_REDIRECTS} redirects, the next run handles the other PRs`,
      )
      break
    }
    // a PR that cannot be processed stays open and must not block the other PRs
    try {
      const reason = await findReasonToSkip(pr, approved)
      if (reason) {
        core.info(`#${pr.number} is skipped: ${reason}`)
        continue
      }
      redirects++
      if (dryRun) {
        core.info(`#${pr.number} by @${pr.user.login} would be redirected`)
        continue
      }
      await redirect(pr, repository.id, repository.discussionCategory.id)
      core.info(`#${pr.number} by @${pr.user.login} is redirected`)
      // GitHub limits how fast a token can create content
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (error) {
      failures++
      core.error(`#${pr.number} failed: ${error.message}`)
    }
  }
  if (failures) {
    core.setFailed(`Cannot process ${failures} PRs`)
  }
}
