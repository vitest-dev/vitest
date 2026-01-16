---
title: IDE Integrations | Guide
---

<script setup>
import { useData } from 'vitepress'
const { isDark } = useData()
</script>

# IDE Integrations

## VS Code <Badge>Official</Badge> {#vs-code}

<p text-center>
<img :src="`https://raw.githubusercontent.com/vitest-dev/vscode/main/img/cover-${isDark ? 'light' : 'dark' }.png`" w-60>
</p>

[GitHub](https://github.com/vitest-dev/vscode) | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=vitest.explorer)

![](https://i.ibb.co/bJCbCf2/202203292020.gif)

## JetBrains IDE

WebStorm, PhpStorm, IntelliJ IDEA Ultimate, and other JetBrains IDEs come with built-in support for Vitest.

<p text-center>
<img :src="`/ide/vitest-jb-${isDark ? 'light' : 'dark'}.png`" w-60>
</p>

[WebStorm Help](https://www.jetbrains.com/help/webstorm/vitest.html) | [IntelliJ IDEA Ultimate Help](https://www.jetbrains.com/help/idea/vitest.html) | [PhpStorm Help](https://www.jetbrains.com/help/phpstorm/vitest.html)

![Vitest WebStorm Demo](https://raw.githubusercontent.com/kricact/WS-info/main/gifs/vitest-run-all.gif)

## Wallaby.js <Badge>Paid (free for OSS)</Badge>

Created by [The Wallaby Team](https://wallabyjs.com)

[Wallaby.js](https://wallabyjs.com) runs your Vitest tests immediately as you type, highlighting results in your IDE right next to your code.

<p text-left>
  <img :src="`/ide/vitest-wallaby-${isDark ? 'light' : 'dark'}.png`" alt="Vitest + Wallaby logos" w-142>
</p>

[VS Code](https://marketplace.visualstudio.com/items?itemName=WallabyJs.wallaby-vscode) | [JetBrains](https://plugins.jetbrains.com/plugin/15742-wallaby) |
[Visual Studio](https://marketplace.visualstudio.com/items?itemName=vs-publisher-999439.WallabyjsforVisualStudio2022) | [Sublime Text](https://packagecontrol.io/packages/Wallaby)

![Wallaby VS Code Demo](https://wallabyjs.com/assets/img/vitest_demo.gif)
