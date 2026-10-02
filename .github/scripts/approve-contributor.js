const BRANCH = 'approved-contributors'
const PATH = 'APPROVED_CONTRIBUTORS'

/**
 * Adds a user to the list of approved contributors when a user with write access
 * comments `/trust` or `/trust username` on a pull request. Sets the `approved` output when the user is on the list.
 */
export default async function approveContributor({ github, context, core }) {
  const { owner, repo } = context.repo
  const comment = context.payload.comment
  const commenter = comment.user.login

  if (!context.payload.issue?.pull_request) {
    core.info('The comment is not on a pull request')
    return
  }

  const match = /^\/trust(?: +@?([a-z\d][a-z\d-]{0,38}))?$/i.exec(comment.body.trim())
  if (!match) {
    core.info('The comment is not an approval command')
    return
  }

  const { data: access } = await github.rest.repos.getCollaboratorPermissionLevel({
    owner,
    repo,
    username: commenter,
  })
  if (!['admin', 'write'].includes(access.permission)) {
    core.info(`@${commenter} has no write access, ignoring the command`)
    return
  }

  let user
  if (match[1]) {
    const { data } = await github.rest.users.getByUsername({ username: match[1] })
    user = data
  } else {
    user = context.payload.issue.user
  }
  // all deleted accounts share the "ghost" account
  if (user.login === 'ghost') {
    core.setFailed('Cannot approve a deleted account')
    return
  }

  // a missing list fails the run, a new list would drop every contributor that was approved before
  async function addToList() {
    const { data: ref } = await github.rest.git.getRef({ owner, repo, ref: `heads/${BRANCH}` })
    const parent = ref.object.sha
    const { data: file } = await github.rest.repos.getContent({
      owner,
      repo,
      path: PATH,
      ref: parent,
    })
    const content = Buffer.from(file.content, 'base64').toString('utf8')

    const approved = content.split('\n').map((line) => /^(\d+)(?: *#.*)?$/.exec(line.trim())?.[1])
    if (approved.includes(String(user.id))) {
      core.notice(`@${user.login} is already an approved contributor`)
      return
    }

    // the tree has no base, the branch keeps only this file
    const { data: tree } = await github.rest.git.createTree({
      owner,
      repo,
      tree: [
        {
          path: PATH,
          mode: '100644',
          type: 'blob',
          content: `${content.trimEnd()}\n${user.id} # ${user.login}\n`,
        },
      ],
    })
    const { data: commit } = await github.rest.git.createCommit({
      owner,
      repo,
      message: `chore: approve contributor ${user.login}\n\nRequested by @${commenter} in ${comment.html_url}`,
      tree: tree.sha,
      parents: [parent],
    })
    // not a force update, it fails if another run changed the list in the meantime
    await github.rest.git.updateRef({ owner, repo, ref: `heads/${BRANCH}`, sha: commit.sha })
    core.notice(`@${user.login} is now an approved contributor`)
  }

  for (let attempt = 1; ; attempt++) {
    try {
      await addToList()
      break
    } catch (error) {
      if (attempt === 3 || error.status !== 422) {
        throw error
      }
    }
  }
  core.setOutput('approved', 'true')
}
