/**
 * 与 `src/lib/schema.ts` 的 JSON-LD 结构对齐（Node 侧无 TS/Astro 解析）。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const BRAND = 'Bio AI Lab';

function buildBreadcrumbSchema(items) {
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

function withBreadcrumbs(schema, breadcrumbs) {
  if (!breadcrumbs?.length) return schema;
  const crumb = buildBreadcrumbSchema(breadcrumbs);
  if (schema['@graph'] && Array.isArray(schema['@graph'])) {
    return { ...schema, '@graph': [...schema['@graph'], crumb] };
  }
  const { '@context': ctx, ...rest } = schema;
  return {
    '@context': ctx || 'https://schema.org',
    '@graph': [rest, crumb],
  };
}

function mergeSchemaGraphs(...schemas) {
  const graph = [];
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

function toolOfficialUrl(tool) {
  const official = tool.text_resources?.find((r) => r.type_class === 'official' && r.href);
  return official?.href;
}

function buildToolSchema(tool, baseUrl, breadcrumbs) {
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

function buildCoursesSchema(courses, baseUrl) {
  const sectionUrl = `${baseUrl}#section-courses`;
  const title = courses.title || 'AI 课程资源';
  const description =
    courses.lead ||
    '按学习路线编排的免费 AI 课程：入门、机器学习、深度学习、LLM 大模型与 AI Agent。';

  const itemListElement = (courses.items || []).map((course, index) => ({
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
      isAccessibleForFree: course.is_free !== false,
      inLanguage: course.language || 'zh-CN',
      ...(course.track ? { educationalLevel: course.track } : {}),
    },
  }));

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

test('buildToolSchema includes SoftwareApplication and LearningResource', () => {
  const schema = buildToolSchema(
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      description: 'OpenAI 通用助手',
      text_resources: [{ type_class: 'official', href: 'https://chatgpt.com' }],
    },
    'https://bio-apple.github.io/ai/',
    [{ name: '首页', url: 'https://bio-apple.github.io/ai/' }],
  );
  const types = schema['@graph'].map((n) => n['@type']);
  assert.ok(types.includes('SoftwareApplication'));
  assert.ok(types.includes('LearningResource'));
  assert.ok(types.includes('WebPage'));
  assert.ok(types.includes('BreadcrumbList'));
  const app = schema['@graph'].find((n) => n['@type'] === 'SoftwareApplication');
  assert.equal(app.url, 'https://chatgpt.com');
});

test('buildCoursesSchema emits Course ItemList', () => {
  const schema = buildCoursesSchema(
    {
      title: 'AI 课程资源',
      lead: '免费课程合集',
      items: [
        {
          title: 'ML 入门',
          url: 'https://example.com/ml',
          summary: '机器学习基础',
          platform: 'Coursera',
          track: '机器学习',
          is_free: true,
        },
      ],
    },
    'https://bio-apple.github.io/ai/',
  );
  const page = schema['@graph'][0];
  assert.equal(page['@type'], 'CollectionPage');
  assert.equal(page.mainEntity.itemListElement.length, 1);
  assert.equal(page.mainEntity.itemListElement[0].item['@type'], 'Course');
});

test('mergeSchemaGraphs combines home and courses', () => {
  const merged = mergeSchemaGraphs(
    { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite' }] },
    { '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage' }] },
  );
  assert.equal(merged['@graph'].length, 2);
});
