---
title: tags | Config
outline: deep
---

# tags <Version>4.1.0</Version> {#tags}

- **Type:** `TestTagDefinition[]`
- **Default:** `[]`

Defines all [available tags](/guide/test-tags) in your test project. By default, if test defines a name not listed here, Vitest will throw an error, but this can be configured via a [`strictTags`](/config/stricttags) option.

If you are using [`projects`](/config/projects), they will inherit all global tags definitions automatically.

Use [`--tags-expr`](/guide/test-tags#syntax) to filter tests by their tags.

::: tip FILTERING
You can use a wildcard (*) to match any number of symbols. To ignore a tag, add an exclamation mark (!) at the start of the tag.
:::

## name
## description
## priority
## Test Options
