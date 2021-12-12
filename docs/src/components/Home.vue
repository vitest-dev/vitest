<script setup lang="ts">
import 'uno.css'
import Avatar from './Avatar.vue'
import '../main.css'
</script>

<template>
  <div flex flex-col items-center>
    <div flex flex-col items-center p="t-10 md:t-20 b-10">
      <img src="/logo.svg" h="40 md:60">
      <h1 text-3em md:text-4em font-light>
        Vitest
      </h1>
      <p text="1.2em center" leading-7 op60 font-normal tracking-wide>
        A blazing fast unit-test framework<br>powered by
        <a href="https://vitejs.dev" target="_blank" font="bold">Vite ⚡️</a>
      </p>
      <div
        text-center
        flex
        flex-col
        sm:flex-row
        flex-wrap
        items-center
        gap-4
        mt-5
        children:my0
      >
        <a class="btn bg-pink-500 hover:bg-pink-600" href="/guide/">
          <span class="i-carbon-play-filled inline-block text-lg" />
          <span ma>Get Started</span>
        </a>
        <a class="btn bg-green-600 hover:bg-green-700" href="/guide/why">
          <span class="i-carbon-flash-filled inline-block text-lg" />
          <span ma>Learn More</span>
        </a>
        <a class="btn bg-gray-500 dark:bg-white dark:text-black hover:bg-gray-700 dark:hover:bg-gray-200" href="https://github.com/antfu-sponsors/vitest">
          <span class="i-carbon-logo-github inline-block text-lg" />
          <span ma>GitHub</span>
        </a>
        <a class="btn bg-sky-600 hover:bg-sky-700" target="_blank" href="https://twitter.com/vitest_dev">
          <span class="i-carbon-logo-twitter inline-block text-1.3em" />
          <span>Twitter</span>
        </a>
      </div>
      <div p-6 text-gray-500 text-center>
        Follow our Twitter subscribing to the latest news! 👆
      </div>
    </div>

    <h3 op50 font-normal pt-10>
      Features
    </h3>
    <ul
      dir="auto"
      max-w-140
      flex="~ col gap-5 md:gap-3"
      text-lg
    >
      <ListItem><a target="_blank" href="https://vitejs.dev">Vite</a>'s config, transformers, resolvers, and plugins.</ListItem>
      <ListItem>Use the same setup from your app to run the tests!</ListItem>
      <ListItem><a href="https://twitter.com/antfu7/status/1468233216939245579" target="_blank">Smart & instant watch mode, like HMR for tests!</a></ListItem>
      <ListItem>Components testing for Vue, React, Lit and more</ListItem>
      <ListItem>Out-of-box TypeScript / JSX support</ListItem>
      <ListItem>ESM first, top level await</ListItem>
      <ListItem>Workers multi-threading via <a href="https://github.com/piscinajs/piscina" target="_blank">Piscina</a></ListItem>
      <ListItem>Filtering, timeouts, concurrent for suite and tests</ListItem>
      <ListItem><a target="_blank" href="https://jestjs.io/docs/snapshot-testing" rel="nofollow">Jest Snapshot</a></ListItem>
      <ListItem><a target="_blank" href="https://www.chaijs.com/" rel="nofollow">Chai</a> built-in for assertions + <a href="https://jestjs.io/docs/expect" rel="nofollow">Jest expect</a> compatible APIs</ListItem>
      <ListItem><a target="_blank" href="https://sinonjs.org/" rel="nofollow">Sinon</a> built-in for mocking</ListItem>
      <ListItem><a target="_blank" href="https://github.com/jsdom/jsdom">jsdom</a> or <a target="_blank" href="https://github.com/capricorn86/happy-dom">happy-dom</a> for DOM mocking</ListItem>
      <ListItem>Native code coverage via <a target="_blank" href="https://github.com/bcoe/c8">c8</a></ListItem>
    </ul>

    <h3 id="made-by" op50 font-normal pt-5 pb-2>
      Made by
    </h3>
    <div grid="~ sm:cols-2 gap-x-10 gap-y-20" p-10>
      <Avatar
        name="Anthony Fu"
        desc=""
        avatar="https://antfu.me/avatar.png"
        github="antfu"
        twitter="antfu7"
      >
        A fanatical open sourceror.<br>Core team member of Vite & Vue.<br>Working at NuxtLabs.
      </Avatar>
      <Avatar
        name="Patak"
        avatar="https://patak.dev/images/patak.jpg"
        github="patak-dev"
        twitter="patak_dev"
      >
        A collaborative being.<br>Core team member of Vite.<br>Team member of Vue.
      </Avatar>
    </div>
    <p op50 text-2xl max-w-150 text-center leading-7>
      And the Vitest contributors. <a href="https://discord.com/invite/2zYZNngd7y">Join the community</a> and get involved!
    </p>
    <div mb-30 />
  </div>
</template>