# Remove UnoCSS - Migration Complete

UnoCSS was causing OOM in CI. Removed entirely and replaced with `@iconify/vue` + plain CSS.

## Summary

- Removed UnoCSS plugin from `vite.config.ts`
- Removed `uno.css` import from `theme/index.ts`
- Added `@iconify/vue` for icons
- Converted all UnoCSS utilities to scoped CSS

## Completed

- [x] `vite.config.ts` - removed UnoCSS plugin
- [x] `theme/index.ts` - removed `import 'uno.css'`
- [x] `CRoot.vue` - @iconify/vue + CSS
- [x] `ListItem.vue` - @iconify/vue + CSS (spinner, checkmark, close icons)
- [x] `CourseLink.vue` - @iconify/vue + CSS
- [x] `FeaturesList.vue` - plain CSS
- [x] `Advanced.vue` - plain CSS
- [x] `Experimental.vue` - plain CSS

## Test pages

- `/guide/features` - FeaturesList, ListItem, CourseLink
- `/config/projects` - CRoot
- `/api/advanced/vitest` - Experimental

## Not used (skipped)

- `HomePage.vue` - not used in new theme
