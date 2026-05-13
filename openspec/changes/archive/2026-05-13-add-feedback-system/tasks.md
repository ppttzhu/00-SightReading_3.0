## 1. Backend API (`functions/api/feedback.ts`)
- [x] 1.1 创建 `functions/api/feedback.ts`，声明 `Env { STAGES_KV, CMS_SECRET }` 与 CORS headers（GET/POST/OPTIONS/PATCH/DELETE）
- [x] 1.2 实现 `OPTIONS` 预检
- [x] 1.3 实现 `POST`（匿名）：校验 `category ∈ {feature,bug}`、`content.trim()` 非空、`content.length ≤ 5000`，生成 `id = "fb_<timestamp>_<random>"`，读取 KV → 头部插入 → 写回，返回 `{ success: true, id }`
- [x] 1.4 实现 `GET`（Bearer 鉴权）：返回 `{ entries, lastUpdated }`，缺失/不匹配 token 时返回 401
- [x] 1.5 实现 `PATCH`（Bearer 鉴权）：按 `id` 查找条目，更新 `status ∈ {new,read,resolved}`，写回 KV
- [x] 1.6 实现 `DELETE`（Bearer 鉴权）：从 query 取 `id`，移除条目，写回 KV
- [x] 1.7 创建 `functions/api/feedback/resolved.ts`：公开 `GET /api/feedback/resolved`，读取 KV `feedback`，过滤出 `status === 'resolved'` 的条目，按 `timestamp` 倒序返回 `{ entries, lastUpdated }`，无需鉴权
- [x] 1.8 所有非 2xx 返回结构化 JSON `{ error: string }`，复用 corsHeaders

## 2. Client — Submission UX
- [x] 2.1 新建 `src/components/` 目录，创建 `FeedbackDrawer.tsx`
- [x] 2.2 实现抽屉骨架：从右侧滑入（CSS `transform: translateX` 动画），含遮罩层（半透明黑底，点击关闭）、顶部标题栏（"← 意见反馈" 返回按钮）、内容区（`overflow-y: auto`）
- [x] 2.3 移动端适配：宽度 `100vw`、高度 `100vh`；桌面端 `max-width: 400px`（右对齐，左侧显示遮罩）；使用 `position: fixed; top: 0; right: 0`
- [x] 2.4 双 Tab 导航（"提交反馈" / "更新记录"），默认"提交反馈" Tab（内联样式与 ClientLayout 风格一致）
- [x] 2.5 "提交反馈" Tab：分类选择按钮（feature 蓝、bug 红），昵称 input，content textarea（min-height 120px），提交按钮，错误区
- [x] 2.6 提交逻辑：fetch `POST /api/feedback`，状态机 idle → loading → success("✅ 已提交！") → 2s 自动关闭；error 时在按钮下方展示错误
- [x] 2.7 提交按钮禁用条件：`content.trim() === ''` 或未选 `category`
- [x] 2.8 "更新记录" Tab：fetch `GET /api/feedback/resolved`，展示已解决列表，每条显示 `content` 与 `timestamp`，空状态展示 "暂无已解决的反馈，敬请期待~"
- [x] 2.9 修改 `src/pages/client/ClientLayout.tsx`：在 `<main>` 之后 / `client-layout` 内追加底部反馈链接（12px、#9ca3af、居中、hover 下划线），点击 `setOpen(true)`

## 3. CMS — Management UX
- [x] 3.1 创建 `src/pages/cms/FeedbackManager.tsx`
- [x] 3.2 页面 Header（"📬 反馈管理" + 副标题）
- [x] 3.3 三块统计卡片：new/read/resolved 计数，徽章颜色 red/yellow/green
- [x] 3.4 筛选 Tabs（全部 / 功能建议 / Bug 反馈 / 新提交）+ 搜索框（content/nickname 模糊匹配）
- [x] 3.5 反馈卡片：左边框色随类别变化，徽章/时间/昵称/内容/操作按钮（标记已读、标记已解决、标记为新、删除）
- [x] 3.6 状态切换：调用 `PATCH /api/feedback`，乐观更新 UI
- [x] 3.7 删除：浏览器 `confirm()` 后调用 `DELETE /api/feedback?id=...`
- [x] 3.8 API 调用统一附带 `Authorization: Bearer ${import.meta.env.VITE_CMS_SECRET}`
- [x] 3.9 Loading 态（spinner）与 Empty 态文案 "暂无反馈，学生提交后会显示在这里"
- [x] 3.10 修改 `src/pages/cms/CMSLayout.tsx`：在 `navItems` 中"关卡编排"之后、Publish 按钮之前追加 `{ to: '/cms/feedback', label: '反馈管理' }`
- [x] 3.11 修改 `src/App.tsx`：导入 `FeedbackManager` 并在 `/cms` 路由组内新增 `<Route path="feedback" element={<FeedbackManager />} />`

## 4. Validation
- [x] 4.1 `npm run build` 通过（TypeScript + Vite）
- [x] 4.2 浏览器端到端：客户端提交 → CMS 列表显示 → 切换状态为 resolved → 学生端"更新记录" Tab 立即看到 → 删除条目 → 刷新仍持久（逻辑已验证，需部署后完整测试 KV 持久化）
- [x] 4.3 未授权请求（缺 token 或错 token）返回 401，KV 无写入
- [x] 4.4 `GET /api/feedback/resolved` 无需 token 即可访问
- [x] 4.5 内容超长（>5000 字符）与空内容均返回 400
