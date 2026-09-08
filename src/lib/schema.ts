import { BRAND, site } from './data';

function siteUrl() {
  return String(site.meta.canonical || site.meta.base_url || 'https://bio-apple.github.io/ai/');
}

function ogImageUrl() {
  const raw = String(site.meta.og_image || '').trim();
  if (raw.startsWith('https://')) return raw;
  return `${siteUrl().replace(/\/?$/, '/')}${raw.replace(/^\//, '') || 'og-image.jpg'}`;
}

function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': `${siteUrl()}#org`,
    name: BRAND,
    url: siteUrl(),
    logo: {
      '@type': 'ImageObject',
      url: ogImageUrl(),
    },
  };
}

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
      inLanguage: 'zh-CN',
      isPartOf: { '@type': 'WebSite', name: BRAND, url: siteUrl() },
      primaryImageOfPage: { '@type': 'ImageObject', url: ogImageUrl() },
      author: organizationNode(),
      publisher: organizationNode(),
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
      name: `${tool.name} 使用指南`,
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

/** 课程专区页：CollectionPage + ItemList(Course) */
export function buildCoursesSchema(courses: CoursesSchemaInput, pageUrl: string) {
  const sectionUrl = pageUrl.includes('.html')
    ? pageUrl
    : `${pageUrl.replace(/\/?$/, '/')}courses.html`;
  const title = courses.title || 'AI 课程资源';
  const description =
    courses.lead ||
    '按方向编排的免费 AI 课程：入门、机器学习、深度学习、LLM 大模型与 AI Agent。';

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
        isPartOf: {
          '@type': 'WebSite',
          name: BRAND,
          url: sectionUrl.replace(/courses\.html$/, '').replace(/\/?$/, '/'),
        },
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
        name: news.title || '近 7×24 小时 AI 热点',
        description: news.lead || '从更新时刻往前 168 小时内的 AI 资讯精选',
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

export function buildOssSchema(
  items: { name: string; repo: string; summary?: string; url?: string }[],
  pageUrl: string,
) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#oss`,
        name: '开源精选',
        description: 'GitHub 升温中的 Agent / MCP / Coding Agent 等开源项目。',
        url: pageUrl,
        inLanguage: 'zh-CN',
        isPartOf: { '@type': 'WebSite', name: BRAND, url: siteUrl() },
        mainEntity: {
          '@type': 'ItemList',
          name: '开源精选',
          numberOfItems: items.length,
          itemListElement: items.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'SoftwareSourceCode',
              name: it.name,
              url: it.url || `https://github.com/${it.repo}`,
              codeRepository: `https://github.com/${it.repo}`,
              description: it.summary || it.name,
            },
          })),
        },
      },
    ],
  };
}

export function buildVideosSchema(
  items: { title: string; url: string; summary?: string; thumbnail?: string }[],
  pageUrl: string,
) {
  const list = (items || []).slice(0, 24);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#videos`,
        name: 'AI 视频',
        url: pageUrl,
        inLanguage: 'zh-CN',
        isPartOf: { '@type': 'WebSite', name: BRAND, url: siteUrl() },
        mainEntity: {
          '@type': 'ItemList',
          name: 'AI 视频',
          numberOfItems: list.length,
          itemListElement: list.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'VideoObject',
              name: it.title,
              url: it.url,
              description: it.summary || it.title,
              ...(it.thumbnail ? { thumbnailUrl: it.thumbnail } : {}),
            },
          })),
        },
      },
    ],
  };
}

export function buildHubSchema(
  boards: { title: string; items: { name: string; url: string; description?: string }[] }[],
  pageUrl: string,
) {
  return {
    '@context': 'https://schema.org',
    '@graph': boards.map((board) => ({
      '@type': 'ItemList',
      name: board.title,
      url: pageUrl,
      numberOfItems: board.items.length,
      itemListElement: board.items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        url: it.url,
        ...(it.description ? { description: it.description } : {}),
      })),
    })),
  };
}

export function buildHomeSchema(input: {
  meta: { canonical: string; description: string; og_image?: string };
  rankings?: { name: string; dimension: string }[];
  oss_frameworks?: {
    repo: string;
    name: string;
    stars?: number;
    summary?: string;
    category?: string;
    heat_score?: number;
  }[];
}) {
  const graph: Record<string, unknown>[] = [
    organizationNode(),
    {
      '@type': 'WebSite',
      '@id': `${input.meta.canonical}#website`,
      name: BRAND,
      url: input.meta.canonical,
      description: input.meta.description,
      inLanguage: 'zh-CN',
      image: ogImageUrl(),
      publisher: { '@id': `${siteUrl()}#org` },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${input.meta.canonical}?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'ItemList',
      name: 'AI 工具排行榜（AICPB / LMSYS / Artificial Analysis 三榜）',
      itemListElement: (input.rankings || []).map((row, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: row.name,
        description: row.dimension,
      })),
    },
  ];

  const oss = [...(input.oss_frameworks || [])]
    .map((fw) => ({
      ...fw,
      stars: Number(fw.stars || 0),
      heat_score: Number(fw.heat_score || 0),
    }))
    .sort((a, b) => b.heat_score - a.heat_score || b.stars - a.stars);
  if (oss.length) {
    graph.push({
      '@type': 'ItemList',
      name: '开源精选 · Agent / MCP / Coding Agent / Harness / Skills / Memory',
      itemListElement: oss.map((fw, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: fw.name,
        url: `https://github.com/${fw.repo}`,
        description: fw.summary || `${fw.repo} · ★ ${fw.stars}`,
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
