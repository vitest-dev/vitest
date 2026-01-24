<script setup>
import Footer from '@components/oss/Footer.vue'
// import TrustedBy from '@components/oss/TrustedBy.vue'
import HeadingSection from '@components/oss/HeadingSection.vue'
import Sponsors from '@components/oss/Sponsors.vue'
import Spacer from '@components/shared/Spacer.vue'
import { sponsors } from '../sponsors'
import VitestFeatureGrid from './FeatureGrid.vue'
import Hero from './Hero.vue'
import Intro from './Intro.vue'
</script>

<template>
  <Hero />
  <!-- 'some-company' requires public/trusted-by/some-company.svg -->
  <!-- <TrustedBy :logos="['some-company']" /> -->
  <Intro />
  <HeadingSection heading="Fast. Lightweight. Integrated." />
  <VitestFeatureGrid />
  <Sponsors
    description="Vitest is free and open source, made possible by wonderful sponsors."
    sponsor-link="https://github.com/sponsors/vitest-dev" :sponsors="sponsors"
  />
  <Spacer />
  <Footer
    heading="Start testing with Vitest"
    subheading="Supercharge your tests with unparalleled performance made for the modern web" button-text="Get started"
    button-link="/guide/"
  />
</template>
