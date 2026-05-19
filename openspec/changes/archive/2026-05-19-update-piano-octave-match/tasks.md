## 1. Spec delta
- [x] 1.1 在 `changes/update-piano-octave-match/specs/notes-practice/spec.md` 中以 `## MODIFIED Requirements` 改写 `Full Piano Keyboard Range`（含完整新 scenario）
- [x] 1.2 同文件中改写 `Swipe And Drag To Pan Keyboard`（含完整新 scenario）

## 2. 验证
- [x] 2.1 `openspec validate update-piano-octave-match --strict` 通过

## 3. 收尾
- [x] 3.1 在同一 PR 内 archive：`openspec archive update-piano-octave-match --yes`，把 MODIFIED 折回 `openspec/specs/notes-practice/spec.md`
