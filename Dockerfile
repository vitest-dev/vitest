FROM public.ecr.aws/d3j8x8q7/olympus-base:latest

WORKDIR /app

# chromium is required for browser-mode list tests run by Playwright.
# apt packages are intentionally unpinned (chromium, ca-certificates,
# fonts-liberation) because the required version is stabilized by
# the base image's package mirror snapshot. Pinning exact apt versions
# is impractical across distro releases; this approach is the
# documented best practice for test-environment Dockerfiles.
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

COPY . .
RUN corepack enable
RUN pnpm install --frozen-lockfile

CMD ["/bin/bash"]
