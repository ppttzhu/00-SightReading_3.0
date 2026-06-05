# Change: 钢琴缩略图六区导航

## Why
Notes piano 模式已有 88 键滑动键盘，但学生在横向滑动时容易迷路，也缺少快速跳到目标音区的入口。Issue #5 希望在滑动键盘上方增加小缩略图，并允许点击音区快速移动。

## What Changes
- 在 `FullPianoKeyboard` 上方新增 88 键缩略导航条
- 缩略图显示当前大键盘可见视窗
- 缩略图默认划分 6 个可点击音区，并直接用 range 作为 label：`A0-B1`, `C2-B2`, `C3-B3`, `C4-B4`, `C5-B5`, `C6-C8`
- 点击某个音区时，大键盘平滑滚动到该区中心，不触发答题或音频
- 保留现有大键盘的滑动、拖拽、点击作答和反馈锁定行为
- 本轮不新增“滑动键盘 / 固定键盘+音区”的 toggle；后续根据老师和同学反馈再调整

## Impact
- Affected specs: `notes-practice`
- Affected code: `src/components/FullPianoKeyboard.tsx`，可能新增同目录测试文件和少量 CSS
- No database or API changes
