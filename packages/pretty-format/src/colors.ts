import type { Colors } from 'tinyrainbow'
import defaultColors, { getDefaultColors } from 'tinyrainbow'

function isAgent() {
  if (typeof process === 'undefined') {
    return false
  }

  const env = process.env

  if (env.AI_AGENT) {
    return true
  }

  return (
    !!env.CLAUDECODE
    || !!env.CLAUDE_CODE
    || !!env.REPL_ID
    || !!env.GEMINI_CLI
    || !!env.CODEX_SANDBOX
    || !!env.CODEX_THREAD_ID
    || !!env.OPENCODE
    || !!env.AUGMENT_AGENT
    || !!env.GOOSE_PROVIDER
    || !!env.CURSOR_AGENT
    || /devin/.test(env.EDITOR || '')
    || /kiro/.test(env.TERM_PROGRAM || '')
    || /\.pi[\\/]+agent/.test(env.PATH || '')
  )
}

const styles: Colors = isAgent() ? getDefaultColors() : defaultColors

export default styles
