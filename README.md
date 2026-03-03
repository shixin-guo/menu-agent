# menu-agent

该仓库当前提供一份可直接交付开发团队执行的方案文档：

- `PRD_TELEGRAM_MENU_AGENT.md`：Telegram 菜单识别与点餐决策 Agent 的 **PRD + 技术拆解任务书**。

文档覆盖：
- Cloudflare Workers + Hono + KV 的无状态架构
- Telegram Webhook + `ctx.waitUntil()` 异步处理模式
- `/pref` 用户偏好存储
- Yelp / Google Maps / SerpApi 评论聚合
- Gemini Prompt 设计与固定 Markdown 输出规范
- 开发排期、验收清单、上线避坑指南

## 使用方式

请直接将 `PRD_TELEGRAM_MENU_AGENT.md` 发给开发团队按模块实施。

## License

MIT
