# Telegram 菜单识别与点餐决策 Agent
## PRD（产品需求文档）+ 技术拆解任务书

## 1. 文档目标
本文件用于指导开发团队按统一架构实现一个 Telegram Bot：
- 接收用户菜单图片（含 Caption 店名/地点）
- 聚合第三方评论（Yelp / Google Maps / SerpApi）
- 结合用户偏好（Cloudflare KV）
- 通过 Gemini 输出中文 Markdown 版「红榜 / 黑榜 / 避雷建议」

核心指导思想：
- **重 Prompt，轻代码**
- **重 API 聚合，轻本地运算**

---

## 2. 产品范围

### 2.1 In Scope（本期范围）
1. Telegram Webhook 消息接收
2. `/pref` 用户偏好写入与读取
3. 图片消息 + Caption 的输入协议
4. 第三方评论抓取与文本拼接
5. Gemini 多模态请求与结构化输出
6. 异步处理与超时重试规避（`ctx.waitUntil`）
7. 失败降级：评论缺失时仍输出建议

### 2.2 Out of Scope（本期不做）
1. 本地 OCR 模型部署
2. 本地向量数据库 / RAG 系统
3. 重量级 SDK（LangChain、Puppeteer 等）
4. 长期对话记忆（除偏好 KV 以外）

---

## 3. 用户画像与核心场景

### 3.1 目标用户
- 在海外用英文菜单点餐的中文用户
- 对忌口、减脂、过敏源有明确需求的用户

### 3.2 关键使用场景
1. 用户先设置偏好：`/pref 不吃香菜，喜欢微辣，减脂中`
2. 用户发送菜单图片，并在 Caption 填写：`法拉盛 穿山甲`
3. Bot 回传：
   - 🔴 红榜（推荐点）
   - ⚫ 黑榜（谨慎/不推荐）
   - 💡 避雷提示（口味冲突、隐藏风险）

---

## 4. 总体架构蓝图（Serverless）

系统必须是**纯无状态 Serverless 函数**：
- 业务逻辑运行于 Cloudflare Workers
- 状态存储仅使用 Cloudflare KV
- 所有外部交互通过 `fetch` HTTP 请求完成

| 模块名称 | 技术实现标准 | 核心职责 |
|---|---|---|
| 网关层 | Cloudflare Workers + Hono.js | 暴露 `/webhook`，接收 Telegram Update，分流消息类型 |
| 存储层 | Cloudflare KV | 存储用户偏好（`chat_id -> 偏好字符串`） |
| 数据采集团 | 原生 `fetch`（无 SDK） | 获取 Telegram 图片 URL、抓取 Yelp/Google/SerpApi 评论 |
| 决策大脑 | Gemini REST API | 输入菜单图片 + 评论文本 + 用户偏好，输出红黑榜 |

---

## 5. 功能需求（按模块拆解）

## 模块一：Telegram 交互与 Webhook 兜底设计

### 任务 1：Webhook 与基础路由
**需求**
- 使用 Hono.js 提供：
  - `POST /webhook`：接收 Telegram update
  - `GET /healthz`：健康检查

**路由行为**
- 文本命令（如 `/pref ...`）走同步快速处理
- 图片消息走异步处理入口

**验收标准**
- 能识别 `message.text`、`message.photo`、`message.caption`
- 无效 payload 返回 200 + 忽略（避免 Telegram 重试）

### 任务 2：超时与重试规避（关键）
**需求**
- 收到图片消息后，必须立即 `return c.text('OK', 200)`
- 后续重任务放入 `ctx.waitUntil(async () => {...})`
- 异步处理完成后调用 Telegram `sendMessage` 主动推送结果

**验收标准**
- Webhook 平均响应 < 1s
- 长耗时（10~30s）情况下 Telegram 不重复重试

---

## 模块二：用户状态与上下文管理

### 任务 3：偏好设置指令 `/pref`
**输入协议**
- 用户发送：`/pref 不吃辣，减肥中`

**处理逻辑**
1. 解析 `/pref` 后的全文字符串
2. 以 `chat_id` 为 key 写入 KV
3. 回执「偏好已更新」

**KV 建议结构**
- Key: `pref:${chat_id}`
- Value: 原始偏好文本（UTF-8）

### 任务 4：触发前置校验
**处理逻辑**
1. 图片任务开始前读取 `pref:${chat_id}`
2. 若为空，使用默认值：`"无特殊偏好"`
3. 作为 Prompt 输入变量

**验收标准**
- 有偏好/无偏好两种分支均可稳定运行

---

## 模块三：外部数据聚合（API 编排）

### 任务 5：Telegram 媒体流提取
**处理步骤**
1. 从 `message.photo` 选择中等分辨率（非最大图）
2. 调 Telegram `getFile` 获取 `file_path`
3. 拼接下载 URL：
   - `https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}`

**验收标准**
- 至少能稳定获取 1 张有效图片 URL
- 图片过大时优先中图，避免 LLM payload 超限

### 任务 6：店名与位置提取（Caption 强约束）
**输入规范**
- 用户发送图片时 Caption 必填：`店名 / 地理位置关键词`
- 示例：`法拉盛 穿山甲`

**处理策略**
- Caption 缺失：直接回复引导模板并终止任务
- Caption 存在：作为评论搜索 query

### 任务 7：第三方评论抓取
**数据源优先级（建议）**
1. Yelp API
2. SerpApi（Google Maps Reviews）
3. 其他可替代 HTTP 数据源

**目标结果**
- 拉取 Top 20 评论文本
- 清洗后拼接为单一长文本 `reviewsContext`

**降级要求**
- API 报错/无结果：`reviewsContext = ""`，流程继续

**验收标准**
- 评论服务失败不影响最终回复生成

---

## 模块四：大模型中枢调优（Prompt Engineering）

### 任务 8：组装超级 Prompt（仅 API 调用）
**实现约束**
- 不写本地 OCR、文本匹配算法
- 只构造 Gemini REST JSON payload
- 推荐模型：Gemini 1.5 Flash（多模态、低延迟）

**Prompt 输入变量**
1. `userPreference`: 用户偏好
2. `captionQuery`: 店名/地点
3. `reviewsContext`: 评论拼接文本
4. `menuImage`: Telegram 图片 URL 或 Base64

### 任务 9：结构化输出约定
**硬性要求**
- 模型输出必须是 Markdown
- 固定板块：
  - `🔴 红榜（推荐点）`
  - `⚫ 黑榜（谨慎点）`
  - `💡 避雷提示`

**建议追加字段**
- 每道菜附：理由、风险标签、是否符合偏好
- 给出 1~2 个最稳妥下单组合

---

## 6. 非功能性要求

1. **性能**：Webhook 同步响应 < 1s
2. **稳定性**：任一外部 API 失败时任务可降级完成
3. **可观测性**：打印 request_id、chat_id、阶段耗时
4. **安全性**：所有密钥仅来自 Workers Secrets，不写入代码仓库
5. **可维护性**：模块化函数拆分，禁止巨型单文件

---

## 7. API 与数据契约（建议）

## 7.1 Telegram Update 输入（简化）
```json
{
  "update_id": 123,
  "message": {
    "chat": { "id": 10001 },
    "text": "/pref 不吃香菜",
    "caption": "法拉盛 穿山甲",
    "photo": [{ "file_id": "abc" }]
  }
}
```

## 7.2 内部任务对象（建议）
```json
{
  "chatId": "10001",
  "captionQuery": "法拉盛 穿山甲",
  "photoFileId": "abc",
  "userPreference": "不吃香菜，喜欢微辣",
  "reviewsContext": "...top20 reviews..."
}
```

## 7.3 最终输出（Markdown）
```md
🔴 红榜（推荐点）
1. ...

⚫ 黑榜（谨慎点）
1. ...

💡 避雷提示
- ...
```

---

## 8. 工程实现规范（硬约束）

1. **禁止引入重依赖**：
   - 禁止 `puppeteer`
   - 禁止 `langchain`
   - 禁止第三方重量级 SDK
2. **全部外呼统一 `fetch`**
3. **Cloudflare Worker 兼容优先**（避免 Node 专属 API）
4. **异常兜底**：所有外部 API 调用必须 `try/catch` + 降级
5. **返回一致性**：任何分支都应给用户可理解的回复

---

## 9. 任务排期建议（可直接分配）

### Sprint 1（基础链路）
- [ ] Workers + Hono 框架初始化
- [ ] `/webhook` 与 `/healthz`
- [ ] `/pref` 写入与读取 KV
- [ ] Telegram `getFile` + `sendMessage`

### Sprint 2（数据与模型）
- [ ] Caption 校验与 query 生成
- [ ] Yelp / SerpApi 评论抓取 + 文本拼接
- [ ] Gemini Prompt 模板与输出格式约束
- [ ] waitUntil 异步编排

### Sprint 3（质量与上线）
- [ ] 失败降级与统一错误文案
- [ ] 日志与耗时监控
- [ ] 集成测试（mock 外部 API）
- [ ] 生产 Webhook 配置与回归

---

## 10. 测试与验收清单（QA Checklist）

1. **指令测试**
- `/pref` 正常写入
- `/pref` 空参数时提示正确

2. **消息类型测试**
- 文本消息、图片消息、图片无 caption、无效 update

3. **链路稳定性**
- 外部 API 全成功
- 评论 API 失败（验证降级）
- Gemini 超时（验证友好失败回复）

4. **格式验收**
- 输出必须包含红榜/黑榜/避雷三段
- Markdown 在 Telegram 中可读

---

## 11. Prompt 模板（开发可直接落地）

```text
你是一个懂中餐/美餐点单策略的中文助手。
请基于以下信息输出“点餐决策报告”。

[用户偏好]
{{userPreference}}

[店名/位置线索]
{{captionQuery}}

[第三方评论文本]
{{reviewsContext}}

[菜单图片]
{{menuImage}}

输出要求（必须严格遵守）：
1) 使用中文 Markdown。
2) 必须包含且仅包含以下一级标题：
   - 🔴 红榜（推荐点）
   - ⚫ 黑榜（谨慎点）
   - 💡 避雷提示
3) 每条推荐都要给出理由，并说明是否符合用户偏好。
4) 若评论数据缺失，明确标注“评论数据不足”，并基于菜单信息给保守建议。
5) 避免泛泛而谈，给出可直接下单的话术。
```

---

## 12. 上线后迭代方向（Backlog）

1. 多语言输出（中/英）
2. 偏好结构化（辣度、忌口、预算）
3. 多图菜单合并分析
4. 历史点单反馈闭环（喜欢/踩雷回写）

