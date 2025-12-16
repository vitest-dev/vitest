# Documentation Issue: Buttons Don't Render Correctly in Dark Mode

## Issue Type
Bug / UI

## Description
Some buttons in the documentation don't render correctly when dark mode is enabled, causing visibility or styling issues.

## Source
Reported as FYI in PR #9240: https://github.com/vitest-dev/vitest/pull/9240

## Details
When viewing the Vitest documentation in dark mode, certain buttons (likely in the search results or other UI components) don't have proper dark mode styling. This could manifest as:
- Poor contrast making buttons hard to see
- Incorrect color schemes
- Missing dark mode variants for button styles

## Evidence
Mentioned in PR #9240 alongside the search .html suffix issue. The exact location and type of buttons affected needs further investigation.

## Expected Behavior
All UI elements, including buttons, should have appropriate dark mode styling that:
- Maintains proper contrast ratios for accessibility
- Follows the dark mode color scheme consistently
- Provides a cohesive user experience

## Affected Components
- VitePress theme customization
- Custom CSS/styling in `.vitepress/theme` or `.vitepress/style`
- Possibly search result UI components

## Suggested Labels
- `documentation`
- `bug`
- `ui`
- `dark-mode`
- `docs-website`
- `accessibility`

## Priority
Medium - Affects user experience and accessibility in dark mode

## Related Files
Theme configuration and styles are likely in:
- `/docs/.vitepress/theme/`
- `/docs/.vitepress/style/`
- `/docs/.vitepress/config.ts`

## Investigation Needed
1. Identify specific buttons that are affected
2. Determine if this is a VitePress theme issue or custom styling issue
3. Check if CSS variables for dark mode are properly defined
4. Verify button components use theme-aware styling
