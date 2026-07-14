# 分析事件字典 + GA4 漏斗配置

统一使用 `trackEvent(name, params)` / `[data-track]`。命名：`snake_case`。

## 核心漏斗（P0）

```
page_view
  → recommend_submit          (funnel_step=1)
  → recommend_query_tool      (funnel_step=2)
  → favorite_add              (funnel_step=3)
```

可选旁路：`recommend_guide_query`、`search_empty` → `#home-recommend`。

## 事件表

| 事件 | 触发 | 关键参数 |
|------|------|----------|
| `recommend_submit` | 推荐表单提交 | `matched`, `funnel_step=1` |
| `recommend_empty_submit` | 空查询提交 | `funnel_step=0` |
| `recommend_query_tool` | 点推荐工具 | `tool`, `funnel_step=2` |
| `recommend_guide_query` | 点学习路线 | — |
| `recommend_scenario` | 展开场景卡片 | `choice` |
| `favorite_add` / `favorite_remove` | 星标 | `tool`, `funnel_step=3`（仅 add） |
| `favorite_export` / `favorite_import` | 导入导出 | `count` |
| `search_empty` | 搜索无结果 | `q` |
| `search_hit` | 点搜索结果 | — |
| `search_error` | 索引失败 | `q` |
| `daily_panel_click` | 简报条目 | `panel` |
| `page_engagement` | 可见时长 ≥5s | `engagement_time_sec` |

## GA4 看板落地步骤（Explore 漏斗）

1. 在 `data/analytics.json` 填入 `ga_measurement_id`，构建并部署。  
2. GA4 → **Explore** → 模板 **Funnel exploration**。  
3. Steps（按顺序）：
   - Step 1: Event name = `recommend_submit`
   - Step 2: Event name = `recommend_query_tool`
   - Step 3: Event name = `favorite_add`
4. 时间范围：过去 7 / 28 天；维度可加 `matched` / `tool`。  
5. 另建报表：事件 `search_empty` 次数（发现内容缺口）。

## 本地校验（无 GA ID 时）

浏览器控制台：

```js
window.__clickStats
```

操作推荐→工具→收藏后，应看到 `recommend_submit` / `recommend_query_tool` / `favorite_add` 计数增加。

配置源：`data/analytics.json` → 构建产物 `analytics-config.json`。
