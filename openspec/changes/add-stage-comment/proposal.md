# Change: 关卡评价系统

## Why
学生完成关卡后缺乏分享感受和互相交流的途径。评价功能让学生能对关卡发表看法、互动，形成社区氛围，同时教师也能从中了解学生对关卡的真实反馈。

## What Changes
- **新增数据库表** `stage_comment` + `comment_like`，支持无限层级的评论树
- **回顾页底部**增加轻量评论输入区（滚到底出现，不占初始视口）
- **新增关卡详情页** `/client/adventure/stage/:stageId`，展示关卡信息 + 评价列表
- **冒险地图卡片**增加评价入口（已完成关卡显示评论数）
- **支持点赞**：每条评论可点赞/取消点赞
- **支持回复**：对评论回复，parent_id 自引用成树

## Impact
- Affected specs: `stage-comment` (new capability)
- Affected code:
  - `src/pages/client/InteractiveQuiz.tsx` — 增加回顾页底部评论输入区
  - `src/pages/client/AdventureMap.tsx` — 卡片增加评价入口和评论数
  - 新增 `src/pages/client/StageDetail.tsx` — 关卡详情页
  - 新增相关 hook 或 store 方法
  - `src/App.tsx` — 新增路由
  - Supabase migration — 新建 `stage_comment` 和 `comment_like` 表
