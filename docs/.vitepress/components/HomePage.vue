<script setup lang="ts">
import { VPTeamMembers } from 'vitepress/theme'
import { teamMembers } from '../contributors'
</script>

<template>
  <div class="content">
    <div class="content-container">
      <main class="main">
        <div class="vp-doc" flex flex-col items-center mt-10>
          <h2 id="meet-the-team" op50 font-normal p="t-10 b-2">
            Meet The Team
          </h2>
          <VPTeamMembers size="small" :members="teamMembers" />
          <h2 id="the-team" op50 font-normal pt-5 pb-2>
            Contributors
          </h2>
          <p text-lg max-w-200 text-center leading-7>
            <Contributors />
            <br>
            <a href="https://chat.vitest.dev" rel="noopener noreferrer">Join the community</a> and get involved!
          </p>

          <h2 id="sponsored-by" op50 font-normal pt-5 pb-2>
            Sponsored by
          </h2>
          <div grid="~ cols-1 lg:cols-2" w-full text-center mt-10>
            <div class="flex flex-col">
              <a text-lg h="32px" href="https://github.com/sponsors/antfu" rel="noopener noreferrer">Anthony's Sponsors</a>
              <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg" target="_blank" rel="noopener noreferrer">
                <img
                  crossorigin="anonymous"
                  inline-block
                  width="768" height="1464"
                  class="resizable-img"
                  loading="lazy"
                  src="/sponsors/antfu.svg"
                  alt="Anthony Fu's sponsors"
                >
              </a>
            </div>
            <div class="flex flex-col">
              <a text-lg h="32px" href="https://github.com/sponsors/patak-dev" rel="noopener noreferrer">Patak's Sponsors</a>
              <a href="https://cdn.jsdelivr.net/gh/patak-dev/static/sponsors.svg" target="_blank" rel="noopener noreferrer">
                <img
                  crossorigin="anonymous"
                  inline-block
                  width="768" height="722"
                  class="resizable-img"
                  loading="lazy"
                  src="/sponsors/patak-dev.svg"
                  alt="Patak's sponsors"
                >
              </a>
            </div>
          </div>
          <p class="text-center opacity-75">
            <a href="https://www.netlify.com" rel="noopener noreferrer">
              <img src="/netlify.svg" alt="Deploys by Netlify" width="114" height="151">
            </a>
          </p>
        </div>
      </main>
    </div>
  </div>
</template>
