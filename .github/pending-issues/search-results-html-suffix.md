# Documentation Issue: Search Results Show .html Suffixes

## Issue Type
Bug / Documentation

## Description
Links in search results have `.html` suffixes, which is inconsistent with the clean URL structure used elsewhere in the documentation.

## Source
Reported as FYI in PR #9240: https://github.com/vitest-dev/vitest/pull/9240

## Details
When using the search functionality in the Vitest documentation, the search results display links with `.html` file extensions (e.g., `/guide/features.html` instead of `/guide/features`).

This is inconsistent with:
- The navigation URLs which don't use `.html` extensions
- Modern documentation site conventions
- The clean URL structure expected by users

## Evidence
Screenshot from PR #9240:
![Search results showing .html suffixes](https://github.com/user-attachments/assets/fb1ab3dc-234a-428c-8f1e-8b800234beae)

## Expected Behavior
Search results should display and link to URLs without `.html` extensions, matching the clean URL structure used in navigation.

## Affected Components
- VitePress search functionality
- Documentation build configuration
- Search index generation

## Suggested Labels
- `documentation`
- `bug`
- `docs-website`

## Priority
Low - This is a minor UX inconsistency that doesn't affect functionality

## Related Configuration
The search configuration is in `/docs/.vitepress/config.ts`:
```typescript
search: {
  provider: 'local',
}
```
