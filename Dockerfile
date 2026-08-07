FROM public.ecr.aws/d3j8x8q7/olympus-base:latest

WORKDIR /app

# chromium is required for browser-mode list tests run by Playwright.
# apt packages are pinned to exact versions for reproducible container builds;
# version values match the base image's package mirror snapshot.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium=1:builds.1.70.0-1~build1 \
    ca-certificates=20240724~ubuntu18.24.1 \
    fonts-liberation=1:2.1.5-5build1 \
  && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

COPY . .
RUN corepack enable
RUN pnpm install --frozen-lockfile

CMD ["/bin/bash"]
