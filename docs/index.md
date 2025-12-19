---
title: Vitest
titleTemplate: Next Generation testing framework
layout: home
theme: dark
---

<script setup>
import { vitestSponsors } from './.vitepress/sponsors'
</script>

<Hero/>
<TrustedBy :logos="['cloudflare', 'mercedes', 'hugging-face']" />
<Intro/>
<HeadingSection
    heading="Fast. Lightweight. Integrated."
  />
<VitestFeatureGrid/>
<Sponsors
  description="Vitest is free and open source, made possible by wonderful sponsors."
  sponsorLink="https://github.com/sponsors/vitest-dev"
  :sponsors="vitestSponsors"
/>
<Spacer />
<Footer
  heading="Start testing with Vitest"
  subheading="Supercharge your tests with unparalleled performance made for the modern web"
  button-text="Get started"
  button-link="/guide/"
/>
