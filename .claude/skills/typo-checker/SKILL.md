---
name: typo-checker
description: >
  Run typos-cli on the codebase, review findings, fix real typos, and update
  _typos.toml config to suppress false positives. Use this skill for routine
  codebase typo maintenance. Invoke when doing periodic codebase hygiene,
  when the user mentions typos or spelling checks, or as a scheduled
  maintenance task.
---

# Typo Checker

Scan the codebase with `typos-cli`, classify findings, fix real typos, and maintain `_typos.toml` so false positives don't recur.

## Prerequisites

`typos-cli` must be installed. If not available, install via one of:

| Method | Command |
|---|---|
| cargo | `cargo install typos-cli` |
| brew | `brew install typos-cli` |
| pipx | `pipx install typos` |
| Binary | Download from https://github.com/crate-ci/typos/releases |

## Workflow

### 1. Scan

```bash
typos --format=brief
```

This outputs one finding per line: `file:line:col: \`typo\` -> \`suggestion\``. Compact and easy to parse.

`typos` respects `.gitignore` by default, so `node_modules/`, `dist/`, build outputs are already excluded.

To get an overview first:

```bash
# Count unique typo words by frequency
typos --format=brief 2>&1 | sed "s/.*\`//;s/\`.*//" | sort | uniq -c | sort -rn | head -20
```

If many findings come from minified/generated files, add those paths to `_typos.toml` `extend-exclude` first, then re-scan.

### 2. Classify each finding

For every finding, decide:

- **Real typo** — fix it
- **False positive** — add to `_typos.toml`

Common false positive patterns:
- Short variable names that happen to be words (`ba`, `fo`, `nd`)
- Domain abbreviations (`als` for AsyncLocalStorage, `PnP` for Plug'n'Play)
- File extensions in regexes (`.styl`, `.pcss`)
- Test fixture strings and test data
- Line truncation artifacts in inline snapshots (`afte...`, `wrapp...`)
- Product names and proper nouns
- Lorem ipsum text

When in doubt about whether a misspelled variable name is "intentional" — it's still a typo. Propagated typos are still typos. Fix them.

### 3. Fix real typos

- **Comments, docs, JSDoc**: fix the text directly
- **Variable/property names**: rename all occurrences consistently
- **Test names**: fix the name, update corresponding snapshot files
- **Filenames**: rename the file and update all imports/references — check for references before renaming

### 4. Update `_typos.toml`

Add false positives to `[default.extend-words]` with a comment explaining why:

```toml
[default.extend-words]
# AsyncLocalStorage abbreviation
als = "als"
```

For file-level exclusions, use `[files].extend-exclude`:

```toml
[files]
extend-exclude = [
  "*.js.map",
  "*.svg",
]
```

If `_typos.toml` doesn't exist yet, create it.

### 5. Commit

Commit fixes and config updates together:

```
chore: fix typos and update _typos.toml
```
