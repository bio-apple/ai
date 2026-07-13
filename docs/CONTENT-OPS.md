# 内容运营验收（P0）

## 周更日历（建议）

| 日 | 动作 |
|----|------|
| 周一 | 确认 `ai-news` / OSS Stars workflow 成功；抽查简报三栏 |
| 每日 | 确认 `daily-videos` 六类非空；B 站封面是否进仓库 |
| 周五 | 工具中心外链抽样 5 条；死链记入 Issue |

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
