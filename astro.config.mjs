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
        // 首页 canonical 为尾斜杠；其余 page 对齐 *.html（build.format=file）
        const home = 'https://bio-apple.github.io/ai';
        let url = String(item.url || '').replace(/\/$/, '');
        if (url === home || url === `${home}/index` || url === `${home}/index.html`) {
          return { ...item, url: `${home}/` };
        }
        if (url && !url.endsWith('.html') && !url.endsWith('.xml')) {
          url = `${url}.html`;
        }
        return { ...item, url };
      },
    }),
  ],
});
