# Change: Add Feedback Collection System

## Why
SightReading 当前没有内置的学生反馈通道。当学生遇到 Bug 或想提建议时，只能通过外部渠道传达，信号容易丢失、改进方向不清晰。需要一个最小可用的端到端反馈系统，让学生匿名提交、教师在 CMS 内闭环管理（new → read → resolved）。

## What Changes
- 新增 `feedback` capability，覆盖学生提交、教师列表/筛选/搜索、状态流转、删除，以及学生查看已解决记录
- 新增后端 API：
  - `POST /api/feedback`：匿名提交（无鉴权）
  - `GET /api/feedback`：列表（需 `Authorization: Bearer <CMS_SECRET>`）
  - `PATCH /api/feedback`：更新状态（需鉴权）
  - `DELETE /api/feedback?id=<id>`：删除条目（需鉴权）
  - `GET /api/feedback/resolved`：公开，只返回 `status === 'resolved'` 的条目（无需鉴权）
- 客户端：在 `ClientLayout` 底部增加反馈入口，从右侧滑出 `FeedbackDrawer`（抽屉面板，新组件目录 `src/components/`）；Drawer 内双 Tab：提交反馈 / 更新记录（已解决列表）。移动端适配：宽度 100vw、高度 100vh、从右侧滑入动画、点击遮罩关闭、左上角返回按钮
- CMS：新增 `FeedbackManager` 页面与 `/cms/feedback` 路由；导航在"关卡编排"后追加"反馈管理"
- 存储：复用 `STAGES_KV` 命名空间，新增键 `"feedback"`，值结构为 `{ entries: FeedbackEntry[], lastUpdated: string }`

## Impact
- Affected specs: `feedback`（新建 capability）
- Affected code:
  - `functions/api/feedback.ts`（新增）
  - `functions/api/feedback/resolved.ts`（新增：公开已解决列表）
  - `src/components/FeedbackDrawer.tsx`（新增，目录新建）
  - `src/pages/cms/FeedbackManager.tsx`（新增）
  - `src/pages/client/ClientLayout.tsx`（修改：底部入口）
  - `src/pages/cms/CMSLayout.tsx`（修改：导航项）
  - `src/App.tsx`（修改：`/cms/feedback` 路由）
- Cloudflare：复用 `STAGES_KV` 与 `CMS_SECRET`，无新绑定，无基础设施变更
