import { BRAND } from './data';

/** JSON-LD 注入 HTML 时转义 `<`，防止内容打断 script 标签 */
export function stringifyJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function isIsoDate(value?: string | null): value is string {
  if (!value || typeof value !== 'string') return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

export type BreadcrumbItem = { name: string; url: string };

export type ToolSchemaInput = {
  name: string;
  description: string;
  id: string;
  text_resources?: { type_class?: string; href?: string }[];
};

export type CourseSchemaItem = {
  title: string;
  url: string;
  summary?: string;
  platform?: string;
  track?: string;
  language?: string;
  is_free?: boolean;
};

export type CoursesSchemaInput = {
  title?: string;
  lead?: string;
  items: CourseSchemaItem[];
};

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

/** 合并多个 @graph  schema（首页 WebSite + 课程 CollectionPage 等） */
export function mergeSchemaGraphs(...schemas: Record<string, unknown>[]) {
  const graph: unknown[] = [];
  let context = 'https://schema.org';
  for (const schema of schemas) {
    if (schema['@graph'] && Array.isArray(schema['@graph'])) {
      graph.push(...schema['@graph']);
    } else {
      const { '@context': ctx, ...rest } = schema;
      if (ctx) context = String(ctx);
      graph.push(rest);
    }
    if (schema['@context']) context = String(schema['@context']);
  }
  return { '@context': context, '@graph': graph };
}

function toolOfficialUrl(tool: ToolSchemaInput): string | undefined {
  const official = tool.text_resources?.find((r) => r.type_class === 'official' && r.href);
  return official?.href;
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

/** 工具独立页：WebPage + SoftwareApplication + LearningResource + BreadcrumbList */
export function buildToolSchema(
  tool: ToolSchemaInput,
  baseUrl: string,
  breadcrumbs?: BreadcrumbItem[],
) {
  const pageUrl = `${baseUrl}tools/${tool.id}.html`;
  const officialUrl = toolOfficialUrl(tool);
  const appId = `${pageUrl}#app`;

  const graph = [
    {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      name: `${tool.name} 使用指南`,
      description: tool.description,
      url: pageUrl,
      inLanguage: 'zh-CN',
      isPartOf: { '@type': 'WebSite', name: BRAND, url: baseUrl },
      about: { '@type': 'SoftwareApplication', '@id': appId },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': appId,
      name: tool.name,
      description: tool.description,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      ...(officialUrl ? { url: officialUrl } : {}),
    },
    {
      '@type': 'LearningResource',
      '@id': `${pageUrl}#tutorial`,
      name: `${tool.name} 教程 2026`,
      description: tool.description,
      learningResourceType: 'Tutorial',
      url: pageUrl,
      inLanguage: 'zh-CN',
      about: { '@type': 'SoftwareApplication', '@id': appId },
      author: { '@type': 'Organization', name: BRAND },
    },
  ];

  return withBreadcrumbs({ '@context': 'https://schema.org', '@graph': graph }, breadcrumbs);
}

/** 首页课程 Tab：CollectionPage + ItemList(Course) */
export function buildCoursesSchema(courses: CoursesSchemaInput, baseUrl: string) {
  const sectionUrl = `${baseUrl}#section-courses`;
  const title = courses.title || 'AI 课程资源';
  const description =
    courses.lead ||
    '按学习路线编排的免费 AI 课程：入门、机器学习、深度学习、LLM 大模型与 AI Agent。';

  const itemListElement = (courses.items || []).map((course, index) => {
    const free = course.is_free !== false;
    return {
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Course',
        name: course.title,
        description: course.summary || course.title,
        url: course.url,
        provider: {
          '@type': 'Organization',
          name: course.platform || 'Unknown',
        },
        isAccessibleForFree: free,
        inLanguage: course.language || 'zh-CN',
        ...(course.track ? { educationalLevel: course.track } : {}),
        ...(free
          ? {
              offers: {
                '@type': 'Offer',
                price: 0,
                priceCurrency: 'CNY',
                category: 'Free',
              },
            }
          : {}),
      },
    };
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${sectionUrl}#courses`,
        name: title,
        description,
        url: sectionUrl,
        inLanguage: 'zh-CN',
        isPartOf: { '@type': 'WebSite', name: BRAND, url: baseUrl },
        mainEntity: {
          '@type': 'ItemList',
          name: title,
          numberOfItems: itemListElement.length,
          itemListElement,
        },
      },
    ],
  };
}

/** 新闻归档页：CollectionPage + ItemList(NewsArticle) */
export function buildNewsSchema(
  news: {
    title?: string;
    lead?: string;
    items: {
      title: string;
      url: string;
      summary?: string;
      source?: string;
      published_at?: string;
    }[];
  },
  baseUrl: string,
) {
  const pageUrl = `${baseUrl}news/daily-ai-news.html`;
  const items = (news.items || []).slice(0, 40);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#news`,
        name: news.title || '一周内 AI 热点',
        description: news.lead || '近一周 AI 资讯精选',
        url: pageUrl,
        inLanguage: 'zh-CN',
        isPartOf: { '@type': 'WebSite', name: BRAND, url: baseUrl },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
              '@type': 'NewsArticle',
              headline: item.title,
              description: item.summary || item.title,
              url: item.url,
              ...(isIsoDate(item.published_at) ? { datePublished: item.published_at } : {}),
              author: { '@type': 'Organization', name: item.source || 'Unknown' },
            },
          })),
        },
      },
    ],
  };
}

/** 本地部署：ItemList(SoftwareApplication) */
export function buildLocalDeploySchema(
  local: {
    title?: string;
    lead?: string;
    categories?: {
      label: string;
      items?: {
        name: string;
        url: string;
        summary?: string;
        tagline?: string;
        platforms?: string[];
      }[];
    }[];
  },
  baseUrl: string,
) {
  const sectionUrl = `${baseUrl}#section-local`;
  const items = (local.categories || []).flatMap((c) =>
    (c.items || []).map((p) => ({ ...p, category: c.label })),
  );
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${sectionUrl}#local`,
        name: local.title || '本地部署',
        description: local.lead || '本机与私有环境大模型部署工具',
        url: sectionUrl,
        inLanguage: 'zh-CN',
        isPartOf: { '@type': 'WebSite', name: BRAND, url: baseUrl },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.map((p, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
              '@type': 'SoftwareApplication',
              name: p.name,
              description: p.summary || p.tagline || p.name,
              url: p.url,
              applicationCategory: 'DeveloperApplication',
              operatingSystem: (p.platforms || []).join(', ') || undefined,
            },
          })),
        },
      },
    ],
  };
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
