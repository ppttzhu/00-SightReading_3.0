# feedback Specification

## Purpose
TBD - created by archiving change add-feedback-system. Update Purpose after archive.
## Requirements
### Requirement: Feedback Data Model
系统 SHALL 使用以下数据结构存储反馈，KV key 为 `"feedback"`，namespace 为 `STAGES_KV`。

```typescript
interface FeedbackEntry {
  id: string;        // "fb_{timestamp}_{random6}"
  category: 'feature' | 'bug';
  nickname?: string;
  content: string;
  timestamp: string; // ISO 8601 UTC
  status: 'new' | 'read' | 'resolved';
}

interface FeedbackStore {
  entries: FeedbackEntry[]; // newest first
  lastUpdated: string;      // ISO 8601 UTC，任意写操作后更新
}
```

#### Scenario: 新条目初始状态
- **WHEN** 一条合法反馈被写入 KV
- **THEN** 该条目 `status` 为 `"new"`，`timestamp` 为写入时刻的 ISO 8601 UTC 字符串，`id` 格式为 `fb_<Date.now()>_<6位随机字母数字>`

### Requirement: Anonymous Feedback Submission
学生 SHALL 可以匿名向 `POST /api/feedback` 提交反馈，无需任何账号或鉴权。系统 MUST 接受 `category ∈ {feature, bug}`、可选 `nickname`、必填 `content`，并将合法条目以 `id = "fb_<timestamp>_<random>"` 写入 `STAGES_KV` 键 `"feedback"` 的 `entries` 数组最前端，同时更新 `lastUpdated`。

#### Scenario: 合法提交成功写入
- **WHEN** 客户端 `POST /api/feedback` 携带 `{ "category": "bug", "content": "无法播放" }`
- **THEN** API 返回 200 与 `{ success: true, id: "fb_..." }`，KV `feedback.entries[0]` 为该新条目，`status` 初始为 `"new"`，`timestamp` 为 ISO 8601 字符串

#### Scenario: 内容为空被拒绝
- **WHEN** `POST` 的 `content` 经 `trim()` 后为空
- **THEN** API 返回 400 与 `{ error: ... }`，KV 不发生写入

#### Scenario: 非法分类被拒绝
- **WHEN** `POST` 的 `category` 不在 `{feature, bug}` 集合内
- **THEN** API 返回 400 与 `{ error: ... }`，KV 不发生写入

#### Scenario: 内容超长被拒绝
- **WHEN** `POST` 的 `content.length > 5000`
- **THEN** API 返回 400 与 `{ error: ... }`，KV 不发生写入

### Requirement: Authenticated Feedback Listing
CMS 教师 SHALL 可以通过 `GET /api/feedback` 获取全部反馈条目。请求 MUST 携带 `Authorization: Bearer <CMS_SECRET>`，否则返回 401。

#### Scenario: 合法鉴权返回列表
- **WHEN** `GET /api/feedback` 携带匹配 `env.CMS_SECRET` 的 Bearer token
- **THEN** API 返回 200 与 `{ entries: FeedbackEntry[], lastUpdated: string }`，条目按插入顺序倒序（最新在前）

#### Scenario: 缺失或错误鉴权
- **WHEN** `GET /api/feedback` 无 `Authorization` 头或 token 与 `CMS_SECRET` 不匹配
- **THEN** API 返回 401 与 `{ error: "Unauthorized" }`

#### Scenario: KV 无数据时返回空列表
- **WHEN** `GET /api/feedback` 合法鉴权，但 KV 键 `"feedback"` 不存在
- **THEN** API 返回 200 与 `{ entries: [], lastUpdated: "" }`

### Requirement: Authenticated Feedback Status Update
CMS 教师 SHALL 可以通过 `PATCH /api/feedback` 将指定 `id` 条目的 `status` 切换到 `new` / `read` / `resolved` 之间任一值。请求 MUST 携带 Bearer `CMS_SECRET`。

#### Scenario: 合法状态更新
- **WHEN** `PATCH /api/feedback` 携带合法 token 与 `{ id, status: "resolved" }`，且 `id` 存在
- **THEN** API 返回 200 与 `{ success: true }`，对应条目 `status` 字段被更新，`lastUpdated` 刷新

#### Scenario: 未授权更新
- **WHEN** `PATCH /api/feedback` 缺少或错误 Bearer token
- **THEN** API 返回 401，KV 不发生写入

#### Scenario: 非法状态值
- **WHEN** `PATCH` 的 `status` 不在 `{new, read, resolved}` 集合内
- **THEN** API 返回 400，KV 不发生写入

#### Scenario: id 不存在
- **WHEN** `PATCH` 携带合法 token 但 `id` 在 `entries` 中不存在
- **THEN** API 返回 404 与 `{ error: "Not found" }`，KV 不发生写入

### Requirement: Authenticated Feedback Deletion
CMS 教师 SHALL 可以通过 `DELETE /api/feedback?id=<id>` 移除反馈条目。请求 MUST 携带 Bearer `CMS_SECRET`。

#### Scenario: 合法删除
- **WHEN** `DELETE /api/feedback?id=fb_123` 携带合法 token，且条目存在
- **THEN** API 返回 200 与 `{ success: true }`，KV `entries` 中不再包含该条目，`lastUpdated` 刷新

#### Scenario: 未授权删除
- **WHEN** `DELETE` 缺少或错误 Bearer token
- **THEN** API 返回 401，KV 不发生写入

#### Scenario: id 不存在
- **WHEN** `DELETE` 携带合法 token 但 `id` 在 `entries` 中不存在
- **THEN** API 返回 404 与 `{ error: "Not found" }`，KV 不发生写入

### Requirement: Public Resolved Feedback Listing
系统 SHALL 通过 `GET /api/feedback/resolved` 公开返回所有 `status === "resolved"` 的反馈条目，无需任何鉴权，按 `timestamp` 倒序（最新解决在前）。

#### Scenario: 无鉴权获取已解决列表
- **WHEN** 客户端 `GET /api/feedback/resolved` 不带 `Authorization` 头
- **THEN** API 返回 200 与 `{ entries: FeedbackEntry[], lastUpdated: string }`，仅包含 `status === "resolved"` 的条目

#### Scenario: 无已解决条目返回空列表
- **WHEN** `GET /api/feedback/resolved` 请求合法，但 KV 中无 resolved 条目
- **THEN** API 返回 200 与 `{ entries: [], lastUpdated: "" }`

### Requirement: Client Feedback Drawer
学生 SHALL 可以在 `/client` 任意页面通过底部入口打开反馈抽屉面板。面板 MUST 从右侧滑入，覆盖全屏（移动端 100vw × 100vh，桌面端 max-width 400px），顶部含返回按钮，点击遮罩层或返回按钮均可关闭。面板内 MUST 提供两个 Tab："提交反馈" 与 "更新记录"，默认显示"提交反馈" Tab。

#### Scenario: 点击入口打开抽屉并重置
- **WHEN** 学生点击 `ClientLayout` 底部的 "💡 有想法？点击告诉我们" 链接
- **THEN** `FeedbackDrawer` 从右侧滑入，默认显示"提交反馈" Tab，表单字段（category、nickname、content）重置为初始空值

#### Scenario: 点击遮罩或返回按钮关闭抽屉
- **WHEN** 学生点击面板左侧遮罩层或顶部 "←" 返回按钮
- **THEN** `FeedbackDrawer` 向右滑出关闭

#### Scenario: 切换至更新记录 Tab
- **WHEN** 学生点击 "更新记录" Tab
- **THEN** 面板内容切换为已解决反馈列表，调用 `GET /api/feedback/resolved` 获取数据，每条展示 `content` 与 `timestamp`

#### Scenario: 更新记录空状态
- **WHEN** "更新记录" Tab 加载完成，但 API 返回空列表
- **THEN** 展示 "暂无已解决的反馈，敬请期待~"

#### Scenario: 必填项缺失时禁用提交
- **WHEN** "提交反馈" Tab 内 `content.trim()` 为空 或 `category` 未选择
- **THEN** "提交反馈" 按钮 `disabled`，点击无效果

#### Scenario: 提交成功显示反馈并自动关闭
- **WHEN** "提交反馈" Tab 中提交后 API 返回 `success: true`
- **THEN** 提交按钮文案切换为 "✅ 已提交！"，2 秒后 Drawer 自动关闭

#### Scenario: 提交失败展示错误
- **WHEN** 提交过程中网络异常或 API 返回非 2xx
- **THEN** Drawer 在提交按钮下方展示错误文案，Drawer 保持打开，按钮恢复为 "提交反馈"

### Requirement: Safe Content Rendering
`FeedbackEntry.content` 与 `nickname` MUST 渲染为纯文本，不得作为 HTML 解析或注入。

#### Scenario: 含 HTML 标签的内容安全展示
- **WHEN** `content` 包含 `<script>alert(1)</script>` 等 HTML 字符串
- **THEN** CMS 页面将其作为字面文本展示，不执行任何脚本，不渲染 HTML 标签

### Requirement: CMS Feedback Management Page
CMS 教师 SHALL 可以在 `/cms/feedback` 页面查看全部反馈条目的统计、筛选、搜索、状态流转与删除操作。所有 API 调用 MUST 携带 `Authorization: Bearer ${import.meta.env.VITE_CMS_SECRET}`。

#### Scenario: 统计卡片反映当前 KV 状态
- **WHEN** FeedbackManager 加载完成
- **THEN** 顶部展示三块计数卡片，分别统计 `status` 为 new / read / resolved 的条目数，数值与最新 `GET /api/feedback` 响应一致

#### Scenario: 类别筛选 + 关键词搜索组合生效
- **WHEN** 教师选择 "Bug 反馈" tab 并在搜索框输入 "无法"
- **THEN** 列表仅展示 `category === "bug"` 且 `content` 或 `nickname` 包含 "无法" 的条目

#### Scenario: 状态切换调用 PATCH
- **WHEN** 教师点击某卡片的 "标记已解决"
- **THEN** 前端发出 `PATCH /api/feedback` 带 `{ id, status: "resolved" }`，成功后卡片状态徽章变为 resolved 绿色

#### Scenario: 删除前需要确认
- **WHEN** 教师点击 "删除"
- **THEN** 浏览器出现确认对话框（`confirm()`），教师确认后才发出 `DELETE /api/feedback?id=<id>`；取消则不发请求

#### Scenario: 空状态文案
- **WHEN** `entries.length === 0`
- **THEN** 列表区域展示 "暂无反馈，学生提交后会显示在这里"

#### Scenario: 加载态展示
- **WHEN** FeedbackManager 正在执行 `GET /api/feedback`
- **THEN** 展示 spinner 或等价加载提示

### Requirement: Navigation and Routing Integration
反馈系统 SHALL 在 CMS 主导航与客户端布局中暴露入口。`/cms/feedback` 路由 MUST 接入 `src/App.tsx` 的 `/cms` 路由组。

#### Scenario: CMS 导航包含反馈管理项
- **WHEN** 教师进入 `/cms` 任意子页
- **THEN** 左侧导航在 "关卡编排" 链接之后、Publish 按钮之前展示 "反馈管理" 链接，点击导航到 `/cms/feedback`

#### Scenario: 客户端底部展示反馈入口
- **WHEN** 学生进入 `/client` 任意子页
- **THEN** 在 `<main>` 区域之后的 `client-layout` 容器内显示 12px、`#9ca3af` 颜色、居中文字 "💡 有想法？点击告诉我们"，hover 时下划线、`cursor: pointer`

#### Scenario: 路由命中渲染 FeedbackManager
- **WHEN** 浏览器访问 `/cms/feedback`
- **THEN** React Router 在 `CMSLayout` 的 `<Outlet />` 中渲染 `FeedbackManager` 组件

