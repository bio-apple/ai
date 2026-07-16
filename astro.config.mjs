import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://bio-apple.github.io',
  base: '/ai/',
  output: 'static',
  build: {
    format: 'file',
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
      serialize(item) {
        // build.format=file 产出 *.html；sitemap 默认无后缀，补齐以对齐 canonical
        const home = 'https://bio-apple.github.io/ai';
        let url = String(item.url || '').replace(/\/$/, '');
        if (url === home || url === `${home}/index` || url === `${home}/index.html`) {
          // 包会去掉尾斜杠，用 index.html 与 file 格式一致
          return { ...item, url: `${home}/index.html` };
        }
        if (url && !url.endsWith('.html') && !url.endsWith('.xml')) {
          url = `${url}.html`;
        }
        return { ...item, url };
      },
    }),
  ],
});
