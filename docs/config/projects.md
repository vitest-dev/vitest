---
title: projects | Config
outline: deep
---

# projects

- **Type:** `TestProjectConfiguration[]`
- **Default:** `[]`

An array of [projects](/guide/projects).

A config file that declares `projects` doesn't run tests itself, it only provides the projects that do. This also applies to project config files: a referenced config that declares `projects` becomes a container for [nested projects](/guide/projects#nested-projects). The option is not supported inside an inline project configuration.
