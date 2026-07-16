# 分析事件字典 + 隐私分析配置

统一使用 `trackEvent(name, params)` / `[data-track]`。命名：`snake_case`。

## 当前状态

| 项                         | 现状                                           |
| -------------------------- | ---------------------------------------------- |
| 仓库 `data/analytics.json` | ID **默认为空**（不提交密钥）                  |
| **推荐（隐私优先）**       | Umami 或 Cloudflare Web Analytics（无 cookie） |
| 可选                       | GA4、Microsoft Clarity（热力图 / 会话回放）    |
| CI / Pages 构建            | 读取下表 Secrets，写入 `analytics-config.json` |
| 未配置时                   | 仅 `window.__clickStats` 本地计数              |

### Secrets / 环境变量

| Secret / Env              | 作用                                                    |
| ------------------------- | ------------------------------------------------------- |
| `UMAMI_SCRIPT_URL`        | Umami 脚本地址（如 `https://cloud.umami.is/script.js`） |
| `UMAMI_WEBSITE_ID`        | Umami 站点 ID                                           |
| `CLOUDFLARE_BEACON_TOKEN` | Cloudflare Web Analytics token                          |
| `GA_MEASUREMENT_ID`       | 可选 GA4 `G-xxxxxxxx`                                   |
| `CLARITY_PROJECT_ID`      | 可选 Clarity（点击热力图 / 录屏）                       |

**推荐组合**：Umami（PV/UV、来源、自定义事件）± Cloudflare Web Analytics；需要热力图时再开 Clarity。

自托管 Umami 时，请把域名加入 CSP（`SecurityMeta.astro` / `_headers`）。

## 核心漏斗（P0）

```
page_view
  → recommend_submit          (funnel_step=1)
    → recommend_query_tool      (funnel_step=2)
      → favorite_add              (funnel_step=3)
```

GitHub 闭环：`github-star-hero` / `github-star-nav` / `github-star-footer`。

可选旁路：`recommend_guide_query`、`recommend_related_tool`、`search_empty` → `#home-recommend`、`learning_continue`。

## 事件表

| 事件                                  | 触发                             | 关键参数                          |
| ------------------------------------- | -------------------------------- | --------------------------------- |
| `recommend_submit`                    | 推荐表单提交                     | `matched`, `funnel_step=1`        |
| `recommend_empty_submit`              | 空查询提交                       | `funnel_step=0`                   |
| `recommend_query_tool`                | 点推荐工具（结果区/场景卡）      | `tool`, `funnel_step=2`           |
| `recommend_related_tool`              | 点「也可以看看」替代/互补        | `tool`, `funnel_step=2`           |
| `recommend_guide_query`               | 点学习路线 / 指南                | —                                 |
| `recommend_scenario`                  | 展开场景卡片                     | `choice`                          |
| `favorite_add` / `favorite_remove`    | 星标                             | `tool`, `funnel_step=3`（仅 add） |
| `favorite_export` / `favorite_import` | 导入导出                         | `count`                           |
| `learning_continue`                   | 首页「继续学习」芯片             | —                                 |
| `roadmap_phase_toggle`                | 学习路线阶段勾选                 | `phase`, `done`                   |
| `github-star-hero` / `nav` / `footer` | Star on GitHub 按钮              | —                                 |
| `tool-rel-alt-*` / `tool-rel-comp-*`  | 工具详情关系链接（`data-track`） | —                                 |
| `hub-rel-alt-*` / `hub-rel-comp-*`    | Hub 关系链接（`data-track`）     | —                                 |
| `search_empty`                        | 搜索无结果                       | `q`                               |
| `search_hit`                          | 点搜索结果                       | —                                 |
| `search_error`                        | 索引失败                         | `q`                               |
| `daily_panel_click`                   | 简报条目                         | `panel`                           |
| `page_engagement`                     | 可见时长 ≥5s（GA 或 Umami）      | `engagement_time_sec`             |

## 看板建议

1. **Umami**：Pages → 来源 / 设备；Events → `recommend_submit`、`github-star-*`
2. **Cloudflare Web Analytics**：PV/UV、国家/地区、热门路径（无自定义事件）
3. **Clarity（可选）**：热力图与愤怒点击；与隐私优先方案并存时请在隐私声明中说明
4. **GA4 Explore 漏斗（可选）**：`recommend_submit` → `recommend_query_tool` → `favorite_add`

## 本地校验（无远端 ID 时）

浏览器控制台：

```js
window.__clickStats;
```

操作推荐→工具→收藏 / 点击 Star 后，应看到对应事件计数增加。

配置源：`data/analytics.json` + 环境变量 → 构建产物 `analytics-config.json`。
