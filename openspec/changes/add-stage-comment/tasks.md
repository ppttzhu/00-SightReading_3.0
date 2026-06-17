## 1. 数据库
- [x] 1.1 创建 `stage_comment` 表迁移 SQL（含 RLS）
- [x] 1.2 创建 `comment_like` 表迁移 SQL（含 RLS）
- [x] 1.3 创建 `comment_like` 触发器，保持 `like_count` 自动同步

## 2. 路由与页面
- [x] 2.1 `App.tsx` 新增 `/client/adventure/stage/:stageId` 路由
- [x] 2.2 新建 `StageDetail.tsx` 页面（关卡信息 + 评价列表）

## 3. 组件
- [x] 3.1 抽取 `ReviewPanel.tsx` 独立组件（从 `InteractiveQuiz.tsx` 移出现有回顾面板）
- [x] 3.2 新建 `StageCommentList` 组件（评价树 + 点赞 + 回复）
- [x] 3.3 新建 `StageCommentForm` 组件（写评论/回复输入区）
- [x] 3.4 新建 `StageCommentActions` 组件（点赞/回复按钮）

## 4. 回顾页集成
- [x] 4.1 `InteractiveQuiz.tsx` 引用 `ReviewPanel` 替换内联回顾代码
- [x] 4.2 `ReviewPanel` 底部集成 `StageCommentForm`

## 5. 冒险地图集成
- [x] 5.1 `AdventureMap.tsx` 关卡卡片显示评论数和入口

## 6. 数据层
- [x] 6.1 封装 `useStageComments` hook（查 + 拼树）
- [x] 6.2 封装评论相关 API（增删查 + 点赞 toggle）
