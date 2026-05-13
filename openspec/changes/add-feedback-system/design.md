## Context
SightReading 是面向音乐视奏练习的 React + Cloudflare Pages 应用。当前 CMS 通过 `functions/api/stages.ts` 将关卡数据写入 `STAGES_KV`，客户端读取后呈现。没有任何形式的用户反馈渠道，教师团队无法系统化收集学生意见与 Bug。本提案在不引入新基础设施的前提下，复用现有 KV + CMS_SECRET 模型，实现端到端反馈闭环。

## Goals / Non-Goals
- Goals:
  - 学生匿名提交反馈（feature/bug 两类），UX 阻力最低
  - 教师在 CMS 一站式查看、筛选、搜索、状态流转、删除
  - 复用 `STAGES_KV` 与 `CMS_SECRET`，零新绑定
  - 与现有内联样式风格、API 模式（CORS、Bearer auth）保持一致
- Non-Goals:
  - 学生账号体系或鉴权（V1 完全匿名）
  - 分页、全文搜索后端化（V1 前端全量加载与筛选）
  - 速率限制、防垃圾、CAPTCHA（V1 接受简单文本提交）
  - 邮件 / Slack / Webhook 通知
  - 多语言（V1 沿用中文文案）

## Decisions

### Decision 1: 单键单文档 KV 存储
- What: KV key `"feedback"` 存储 `{ entries: FeedbackEntry[], lastUpdated: string }`，新条目从数组前端插入。
- Why: 与 `stages` 键模式一致；一次 GET 取全量利于前端筛选/搜索；列表反向排序天然由插入顺序保证。
- Alternatives:
  - 每条反馈一个 KV 键（如 `feedback:<id>`）：KV 列表 API 慢且无聚合，CMS 难以一次性渲染统计。
  - 引入 D1/Postgres：V1 规模（数百至千级）远未达到需要关系数据库的复杂度，违反"简化优先"。
- Trade-off: **并发写存在 read-modify-write 数据丢失风险**——两个学生同时提交，后写覆盖前写，一条反馈消失且无感知。V1 接受该风险（学生反馈低频、非关键数据），升级路径：迁移到每条一个 KV key + `KV.list({ prefix: 'feedback:' })` 聚合，或使用 Durable Object 串行化写入。

### Decision 2: 不对称鉴权
- What: `POST` 公开匿名；`GET / PATCH / DELETE` 要求 `Authorization: Bearer <CMS_SECRET>`。
- Why: 学生端无登录态可携带，要求鉴权将阻断核心提交流程；CMS 端复用现有 `VITE_CMS_SECRET` 环境变量保持一致。
- Trade-off: 与 `stages.ts`（POST 需鉴权）方向相反，需在 spec 与代码注释中显著标注，避免误判 API 模式。**`VITE_CMS_SECRET` 在 Vite 构建时被 inline 到客户端 bundle，任何访问网站的人均可从 JS 中提取。鉴权强度等同于混淆（obfuscation），而非真正的访问控制。V1 接受该风险（与现有 stages 鉴权模型一致）；V2 如需真正保护，应迁移到 server-side session 或 Cloudflare Access。**

### Decision 3: 内联样式 + 现有目录约定
- What: 沿用 `ClientLayout`/`CMSLayout` 的内联 style 对象，不引入 CSS-in-JS 或 Tailwind。
- Why: 现有代码无 CSS 体系；为 V1 单功能引入新风格会拉大改动半径。
- Trade-off: 样式难复用；接受 V1 范围，后续可统一抽出。

### Decision 4: 内容长度上限 5000 字符
- What: 后端 POST 校验 `content.length ≤ 5000`，否则 400。
- Why: 防止意外/恶意大对象写入 KV（25MB 上限），降低单条目膨胀风险。
- Trade-off: 极少数长内容被截断；可在 V2 提升至更大值或支持附件。

## Risks / Trade-offs
- 并发覆盖 → V1 接受；后续可迁移到 Durable Object 实现串行写入。
- 滥用提交（无速率限制） → V1 公开发布前依赖 Cloudflare 自带 WAF 与可观察的 KV 大小监控；高频滥用时手动清空。
- KV value 25MB 上限 → 5000 字符 × 100k 条 ≈ 远低于上限，V1 内安全。

## Migration Plan
- 部署：无数据迁移（新键）；首次写入由 `POST` 自然创建。
- 回滚：删除 KV 键 `feedback` 或撤回路由/UI 改动；其他子系统不受影响。

## Open Questions
- 是否需要在 Modal 收集上下文（当前关卡 ID、模块）以便教师追溯？默认否，留 V2 与 telemetry 一起设计。
- 教师端是否需要导出 CSV/复制全部内容？默认否，V2 视实际使用决定。
