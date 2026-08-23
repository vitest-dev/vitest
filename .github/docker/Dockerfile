# CI image with Playwright system dependencies pre-installed, so Linux browser
# jobs skip `playwright install-deps` on every run. Browser binaries are NOT
# baked in; jobs install them through the setup-playwright cache.
# git and ca-certificates are required by actions/checkout inside container
# jobs; zstd keeps actions/cache archives compatible with the runner VMs.
FROM node:24-bookworm-slim

ARG PLAYWRIGHT_VERSION
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates zstd \
  && npx -y "playwright@${PLAYWRIGHT_VERSION}" install-deps \
  && rm -rf /var/lib/apt/lists/*

# CI runs the container with --user 1001 (the GitHub runner user, which owns
# the mounted volumes); create it so passwd lookups resolve
RUN useradd -m -u 1001 runner
