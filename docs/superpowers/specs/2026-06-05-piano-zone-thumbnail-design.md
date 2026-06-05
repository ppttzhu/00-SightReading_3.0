# Piano Zone Thumbnail Design

## Context
Issue #5 asks for a small keyboard thumbnail above the existing horizontally scrollable 88-key piano. Students can currently swipe or drag the full keyboard, but they can lose their place and cannot jump quickly to a target register.

During visual brainstorming, we chose the "thumbnail keyboard with anchors" direction and removed the larger "fixed keyboard + zone toggle" idea from this change. The keyboard should remain directly usable by sliding; the thumbnail adds orientation and fast navigation.

## Goals
- Add a compact thumbnail above `FullPianoKeyboard` in piano input mode.
- Show the current full-keyboard viewport inside the thumbnail.
- Divide the thumbnail into six clickable register zones.
- Clicking a zone scrolls the full keyboard to that zone's center without submitting an answer.
- Keep the existing swipe, drag, click-to-answer, and feedback-lock behavior intact.

## Non-Goals
- Do not add a toggle between sliding keyboard and fixed keyboard.
- Do not change answer semantics or note generation.
- Do not require teacher/CMS configuration for the six zones in this first pass.

## Default Zone Model
The initial six zones use C-centered octave boundaries with slightly wider edge zones:

| Zone | Range | Label |
| --- | --- | --- |
| 1 | `A0-B1` | `A0-B1` |
| 2 | `C2-B2` | `C2-B2` |
| 3 | `C3-B3` | `C3-B3` |
| 4 | `C4-B4` | `C4-B4` |
| 5 | `C5-B5` | `C5-B5` |
| 6 | `C6-C8` | `C6-C8` |

These range labels and boundaries can change later based on teacher/student feedback, but the first implementation should hard-code them in the keyboard component to avoid unnecessary settings.

## Interaction Design
`FullPianoKeyboard` renders the thumbnail immediately above the full keyboard. The thumbnail is a small horizontal piano strip with six translucent clickable zone frames, range labels, and a stronger viewport frame.

When the user scrolls the full keyboard by touch, mouse drag, or native scrollbar, the viewport frame updates from `scrollLeft`, `clientWidth`, and the total keyboard width. While scrolling, the thumbnail becomes more opaque; when idle, it can settle back to a quieter semi-transparent state.

When the user clicks a zone, the component computes the zone center from the corresponding piano key positions and calls `scrollTo({ left, behavior: 'smooth' })` on the full keyboard container. The click does not play audio and does not call `onAnswer`.

## Component Boundaries
- `FullPianoKeyboard.tsx` owns key geometry, scroll state, the thumbnail, and zone navigation.
- Existing callers in `PracticeQuiz.tsx` and `InteractiveQuiz.tsx` should not need API changes.
- CSS can live in `src/index.css` if class-based styling is clearer than inline SVG styles.

## Testing
- Add focused tests for zone data and scroll target calculation so the range model is protected.
- Add component tests that verify six zone buttons render and that clicking one changes the scroll position or calls the injected scroll behavior.
- Keep existing notes-practice tests passing.

## Open Questions
- Teacher-specific labels for the six zones are intentionally deferred.
- If feedback shows the first/last zones feel too wide, we can adjust only the zone config without changing the interaction model.
