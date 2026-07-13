# 分析事件字典（P0）

统一使用 `trackEvent(name, params)` / `[data-track]`。命名：`snake_case`。

## 首页漏斗

```
page_view (GA 自动)
  → recommend_submit
  → recommend_query_tool | recommend_guide_query
  → favorite_add
  → （可选）lab_open / tools hub
```

## 事件表

| 事件 | 触发 | 关键参数 |
|------|------|----------|
| `recommend_submit` | 推荐表单提交 | `matched` |
| `recommend_query_tool` | 点推荐工具 | `tool` |
| `recommend_guide_query` | 点学习路线 | — |
| `recommend_scenario` | 展开场景卡片 | `choice` |
| `recommend_goto_favorites` | 推荐结果→收藏 | — |
| `recommend_goto_cases` | 推荐结果→案例 | — |
| `favorite_add` / `favorite_remove` | 星标 | `tool` |
| `favorite_export` / `favorite_import` | 导入导出 | `count` |
| `daily_panel_click` | 简报条目 | `panel` |
| `daily_news_more` / `daily_videos_more` | 简报更多 | — |
| `page_engagement` | 可见时长 ≥5s | `engagement_time_sec` |

## GA4 看板建议

1. 事件：`recommend_submit` 次数（周）  
2. 转化：`recommend_submit` → `recommend_query_tool`  
3. 留存代理：`favorite_add` 独立用户（需 GA4 user）  

配置：`data/analytics.json` → 构建为 `analytics-config.json`。
