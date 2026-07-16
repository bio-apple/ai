# 内容运营验收（P0）

## 周更日历（建议）

| 日 | 动作 |
|----|------|
| 每日 | 确认 `daily-videos` 六类非空；确认 `daily-news` 成功；抽查简报三栏 |
| 周一 | 确认 `weekly-oss` Star 刷新成功 |
| 月初 | 更新 `data/rankings.json`：用户量 / 模型能力 / 价格三榜；同步 `site.json` → `rankings` 三项冠军与 `ranking_page.updated` |
| 周五 | 工具中心外链抽样 5 条；死链记入 Issue |

## 排行榜（按月）

源文件：`data/rankings.json`。

- 三个 `dimensions`：`users`（用户量）、`capability`（模型能力）、`price`（价格）
- `highlights`：三项冠军（首页/Schema 预览用，需与 `site.json` → `rankings` 保持一致）
- 改完后：`npm run build` + 打开 `/ai/ai-tools-ranking.html` 目视三榜

## 工具中心「延伸推荐」验收

每个 `tool_hub[].external[]` 必须有：

- `name`、`url`（https）  
- 一句 `note`（用途，非广告口号）  
- 抽查：移动端可打开、无强制登录墙（或注明需登录）

站内 `tools` 条目优先有独立教程页（`tools/{id}.html`）。

## 简报导语模板

```
本周关注：{1 句趋势}
今日可学：{1 条视频或工具}
行动：打开推荐助手，输入你的场景
```

## 死链巡检

```bash
python3 scripts/check_external_links.py   # 周任务，非阻断
DIST=dist python3 scripts/validate_ci.py links
```
