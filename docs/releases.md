<script setup>
import SupportedVersions from './.vitepress/theme/SupportedVersions.vue';
</script>

# Releases

Vitest releases follow [Semantic Versioning](https://semver.org/). You can see the latest stable version of Vitest in the [Vitest npm package page](https://www.npmjs.com/package/vite).

A full changelog of past releases is [available on GitHub](https://github.com/vitest-dev/vitest/releases).

## Release Cycle

Vitest does not have a fixed release cycle.

- **Patch** releases are released as needed (usually every week).
- **Minor** releases always contain new features and are released as needed. Minor releases always have a beta pre-release phase (usually every two months).
- **Major** releases generally align with [Vite](https://vite.dev/releases) and [Node.js EOL schedule](https://endoflife.date/nodejs), and will be announced ahead of time. These releases will have a long beta pre-release phases (usually every year).

## Supported Versions

In summary, the current supported Vitest versions are:

<SupportedVersions />

<br>

The supported version ranges are automatically determined by:

- **Current Minor** gets regular fixes.
- **Previous Major** (only for its latest minor) and **Previous Minor** receives important fixes and security patches.
- All versions before these are no longer supported.

We recommend updating Vitest regularly. Check out the [Migration Guides](/guide/migration) when you update to each Major. We test new Vitest versions before releasing them through the [vitest-ecosystem-ci project](https://github.com/vitest-dev/vitest-ecosystem-ci). Most projects using Vitest should be able to quickly offer support or migrate to new versions as soon as they are released.

## Semantic Versioning Edge Cases

### TypeScript Definitions

We may ship incompatible changes to TypeScript definitions between minor versions. This is because:

- Sometimes TypeScript itself ships incompatible changes between minor versions, and we may have to adjust types to support newer versions of TypeScript.
- Occasionally we may need to adopt features that are only available in a newer version of TypeScript, raising the minimum required version of TypeScript.
- If you are using TypeScript, you can use a semver range that locks the current minor and manually upgrade when a new minor version of Vite is released.

## Pre Releases

Minor releases typically go through a non-fixed number of beta releases. Major releases will go through a long beta phase.

Pre-releases allow early adopters and maintainers from the Ecosystem to do integration and stability testing, and provide feedback. Do not use pre-releases in production. All pre-releases are considered unstable and may ship breaking changes in between. Always pin to exact versions when using pre-releases.

## Deprecations

We periodically deprecate features that have been superseded by better alternatives in Minor releases. Deprecated features will continue to work with a type or logged warning. They will be removed in the next major release after entering deprecated status. The [Migration Guide](/guide/migration.html) for each major will list these removals and document an upgrade path for them.

## Experimental Features

Some features are marked as experimental when released in a stable version of Vite. Experimental features allow us to gather real-world experience to influence their final design. The goal is to let users provide feedback by testing them in production. Experimental features themselves are considered unstable, and should only be used in a controlled manner. These features may change between Minors, so users must pin their Vite version when they rely on them. We will create [a GitHub discussion](https://github.com/vitest-dev/vitest/discussions/categories/feedback?discussions_q=is%3Aopen+label%3Aexperimental+category%3AFeedback) for each experimental feature.
