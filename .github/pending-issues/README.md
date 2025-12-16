# Pending Issues

This directory contains documentation for issues that have been identified but not yet created as GitHub issues.

## Purpose

This directory serves as a staging area for issue descriptions that:
- Have been discovered during development or PR review
- Need to be tracked but aren't urgent enough to create immediately
- Require additional context or investigation before being formalized
- Were mentioned as "FYI" in pull requests

## Process

1. **Documentation**: Issues are documented in markdown files with clear descriptions
2. **Review**: Maintainers can review these pending issues periodically
3. **Creation**: When appropriate, maintainers can create actual GitHub issues from these descriptions
4. **Cleanup**: Once an issue is created on GitHub, the corresponding markdown file should be deleted and a link to the GitHub issue added to the commit message

## File Format

Each issue documentation file should include:
- Clear title
- Issue type (bug, feature, documentation, etc.)
- Detailed description
- Source/origin of the issue
- Expected behavior
- Affected components
- Suggested labels
- Priority assessment

## Current Pending Issues

1. **search-results-html-suffix.md** - Search results show .html suffixes (from PR #9240)
2. **dark-mode-button-rendering.md** - Buttons don't render correctly in dark mode (from PR #9240)
