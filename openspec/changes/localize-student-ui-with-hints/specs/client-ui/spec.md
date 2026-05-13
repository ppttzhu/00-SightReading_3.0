## ADDED Requirements

### Requirement: Bilingual Module Labels
学生端首页 `MainMenu` SHALL 以「主中文 + 副英文」双语形式展示四个练习模块。中文为主标题（字号较大、加粗），英文为副标题（字号较小、颜色较浅），确保学生直观理解模块含义，同时保留乐谱术语的英文对照。

```typescript
interface ModuleConfig {
  id: string;
  label: string;      // 中文主标题，如 "音符"
  title: string;      // 英文副标题，如 "Notes"
  color: string;
  bg: string;
  icon: React.ReactNode;
  hint: string;       // Tooltip 提示文案
}
```

#### Scenario: 首页展示双语卡片
- **WHEN** 学生访问 `/client`
- **THEN** 页面展示四个模块卡片，每个卡片上主标题为中文（如 "音符"），副标题为英文（如 "Notes"）

#### Scenario: 模块标识与路由保持一致
- **WHEN** 学生点击 "音符 Notes" 卡片
- **THEN** 路由跳转到 `/client/module/notes`，与原有路由行为一致

### Requirement: Module Hint Tooltips
每个模块卡片左上角 SHALL 放置一个 ⓘ 提示按钮。桌面端 hover 该按钮时弹出 Tooltip 气泡；移动端通过点击触发（tap 展开，再次点击或点击外部关闭）。Tooltip 气泡 MUST 展示该模块的 2-3 行简介，包含练习内容、适合人群、大致耗时。

#### Scenario: 桌面端 hover 显示提示
- **WHEN** 学生将鼠标悬停在 "音符" 卡片的 ⓘ 按钮上
- **THEN** 从按钮下方/右侧弹出白色气泡，显示 "识别五线谱上的音名，建立读谱基础。适合零基础学员。单关约 3-5 分钟。"

#### Scenario: 移动端点击展开提示
- **WHEN** 学生在移动设备上点击 "符号" 卡片的 ⓘ 按钮
- **THEN** 弹出同样的提示气泡；再次点击 ⓘ 按钮或点击卡片其他区域，气泡关闭

#### Scenario: Tooltip 不触发卡片跳转
- **WHEN** 学生点击 ⓘ 按钮（移动端）或卡片区域（桌面端）
- **THEN** 点击 ⓘ 按钮仅控制 Tooltip 显示/隐藏，不触发卡片本身的 `onClick` 导航事件

#### Scenario: Tooltip 不超出视口
- **WHEN** 提示气泡显示时，计算位置会导致超出视口右边缘
- **THEN** 气泡自动向左偏移，确保完整显示在视口内

### Requirement: Student-Facing Page Localization
学生端所有面向学生的可见文案 SHALL 使用中文，保留英文术语作为辅助信息。具体包括：`MainMenu` 大标题、`StageSelector` 页面标题与返回按钮、`StageSelector` 空状态文案。

#### Scenario: MainMenu 标题中文化
- **WHEN** 学生访问 `/client`
- **THEN** 页面顶部大标题显示 "选择练习项目" 而非 "Select Your Trial"

#### Scenario: StageSelector 返回按钮中文化
- **WHEN** 学生进入任一模块的关卡选择页
- **THEN** 左上角返回按钮显示 "← 返回主菜单" 而非 "← Back to Menu"

#### Scenario: StageSelector 空状态中文化
- **WHEN** 学生进入尚无题目的模块
- **THEN** 页面展示 "暂无可用关卡" 和 "请联系老师为该模块添加题目。"
