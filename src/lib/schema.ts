import { BRAND } from './data';

export type BreadcrumbItem = { name: string; url: string };

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function withBreadcrumbs<T extends Record<string, unknown>>(
  schema: T,
  breadcrumbs?: BreadcrumbItem[],
) {
  if (!breadcrumbs?.length) return schema;
  const crumb = buildBreadcrumbSchema(breadcrumbs);
  if (schema['@graph'] && Array.isArray(schema['@graph'])) {
    return { ...schema, '@graph': [...schema['@graph'], crumb] };
  }
  const { '@context': ctx, ...rest } = schema as T & { '@context'?: string };
  return {
    '@context': ctx || 'https://schema.org',
    '@graph': [rest, crumb],
  };
}

export function buildPageSchema(
  title: string,
  description: string,
  url: string,
  breadcrumbs?: BreadcrumbItem[],
) {
  return withBreadcrumbs(
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url,
      author: { '@type': 'Organization', name: BRAND },
    },
    breadcrumbs,
  );
}

export function buildToolSchema(
  tool: { name: string; description: string; id: string },
  baseUrl: string,
  breadcrumbs?: BreadcrumbItem[],
) {
  return withBreadcrumbs(
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: `${tool.name} 教程 2026`,
      description: tool.description,
      author: { '@type': 'Organization', name: BRAND },
      mainEntityOfPage: `${baseUrl}tools/${tool.id}.html`,
    },
    breadcrumbs,
  );
}

export function buildCompareSchema(
  compare: { title: string; meta_description: string; slug: string },
  baseUrl: string,
  breadcrumbs?: BreadcrumbItem[],
) {
  return withBreadcrumbs(
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: compare.title,
      description: compare.meta_description,
      author: { '@type': 'Organization', name: BRAND },
      mainEntityOfPage: `${baseUrl}compare/${compare.slug}.html`,
    },
    breadcrumbs,
  );
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
      name: '2026 AI 工具排行榜（AICPB 五榜 Top 10）',
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
