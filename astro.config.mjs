import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import rehypeDiagram from './src/plugins/rehype-diagram.mjs';

// 站点 URL 与资源路径前缀均通过环境变量注入，换域名 / 换托管 / 切子目录时无需改源码。
// SITE_URL  例：https://yourname.dev
// BASE_PATH 例：/ （根路径）或 /some-sub/ （子路径托管）
const site = process.env.SITE_URL ?? 'https://example.com';
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  markdown: {
    // Astro 7 默认处理器是 Sätteri；插件需要走 unified 处理器，
    // 这样内容里写 ![图注](diagram:名称) 就会就地内联该图 SVG
    processor: unified({ rehypePlugins: [rehypeDiagram] }),
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
