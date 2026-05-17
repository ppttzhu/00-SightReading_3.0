## 1. Core

- [x] 1.1 Create `src/pages/client/IntervalPractice.tsx` — rule-based interval generation + VexFlow rendering
- [x] 1.2 Implement generation algorithm: pitch range constraint, interval type/direction mapping, clef auto-detect
- [x] 1.3 Implement melodic interval rendering (two half notes side-by-side, reused from InteractiveQuiz C-type logic)
- [x] 1.4 Implement harmonic interval rendering (stacked whole notes, accidental offset for collisions)
- [x] 1.5 Build answer options: dynamic pool based on selected interval type, 4-option layout
- [x] 1.6 Add interval "bridge" arc annotation on wrong answer (colored arc + interval name label)

## 2. UI Integration

- [x] 2.1 Add practice mode toggle + parameter controls to `StageSelector.tsx` for theory module
- [x] 2.2 Wire "开始练习" button → navigate to `/client/practice/intervals?type=...&direction=...&clef=...&mode=...`
- [x] 2.3 Ensure feedback animations (green/red background, card glow, shake) consistent with existing patterns
- [x] 2.4 Add blink/persistence effect (show 3s, hide 6s) consistent with existing modes
- [x] 2.5 Ensure keyboard input (C D E F G A B) does NOT trigger in interval mode

## 3. Polish

- [x] 3.1 Handle edge cases: extreme intervals, accidental collision in harmonic mode
- [x] 3.2 Test with all interval type selections produce valid, in-range notes
- [x] 3.3 Verify VexFlow renders correctly for both clefs and all interval types
