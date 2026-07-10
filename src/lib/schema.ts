import { BRAND } from './data';

export function buildPageSchema(title: string, description: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url,
    author: { '@type': 'Organization', name: BRAND },
  };
}

export function buildToolSchema(tool: { name: string; description: string; id: string }, baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: `${tool.name} 教程 2026`,
    description: tool.description,
    author: { '@type': 'Organization', name: BRAND },
    mainEntityOfPage: `${baseUrl}tools/${tool.id}.html`,
  };
}

export function buildCompareSchema(compare: { title: string; meta_description: string; slug: string }, baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: compare.title,
    description: compare.meta_description,
    author: { '@type': 'Organization', name: BRAND },
    mainEntityOfPage: `${baseUrl}compare/${compare.slug}.html`,
  };
}

export function buildHomeSchema(site: {
  meta: { canonical: string; description: string };
  faq?: { question: string; answer: string }[];
  rankings?: { name: string; dimension: string }[];
}) {
  const graph = [
    {
      '@type': 'WebSite',
      name: BRAND,
      url: site.meta.canonical,
      description: site.meta.description,
      inLanguage: 'zh-CN',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${site.meta.canonical}?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: (site.faq || []).map((q) => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: { '@type': 'Answer', text: q.answer },
      })),
    },
    {
      '@type': 'ItemList',
      name: '2026 AI 工具排行榜',
      itemListElement: (site.rankings || []).map((row, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: row.name,
        description: row.dimension,
      })),
    },
  ];
  return { '@context': 'https://schema.org', '@graph': graph };
}
