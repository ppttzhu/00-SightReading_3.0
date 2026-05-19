# Change: piano 模式作答按八度精确匹配（修订两条已归档需求）

## Why
PR #11（已合并）修复了 [#8](https://github.com/ppttzhu/00-SightReading_3.0/issues/8)：piano 模式下，题目是 C4 时按 C2/C3/C5/… 也判对的 bug。

代码已经改成"八度严格相等 + 同八度内 sharp/flat 等音对等价"，但 `openspec/specs/notes-practice/spec.md` 仍然保留了旧的"作答语义仅取音名……同名键(如 C3 与 C4)在判分上等价"和"以被按下的琴键音名为答案"两条 scenario，与现行实现矛盾。本次 change 用 MODIFIED 把这两条 requirement 改成与代码一致。

## What Changes
- **MODIFIED** `Full Piano Keyboard Range`：把"作答语义仅取音名" scenario 改为"作答语义按八度精确匹配"。前两条 scenario（首次居中 C4、八度标签与中央 C 标记）保持不变。
- **MODIFIED** `Swipe And Drag To Pan Keyboard`：把"短按视为作答" scenario 里"以被按下的琴键音名为答案"改为"以被按下的琴键音高(含八度)为答案"。其余 3 条 scenario（触屏滑动、桌面拖动、反馈期忽略）保持不变。

## Impact
- Affected specs: `notes-practice`
- Affected code: 无（行为变更已经在 PR #11 落地）
- 文档/测试：纯 spec 修订；`src/core/engine/pitchUtils.test.ts` 已覆盖新语义（16 例）
