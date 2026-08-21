import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Renderer, Stave, StaveNote, BarNote, Voice, Formatter, Accidental, Beam, Dot, Stem } from 'vexflow';
import { audioEngine } from '../../core/engine/AudioEngine';
import { playTonic, playMelody } from '../../core/engine/playbackAudio';
import { useMidi } from '../../hooks/useMidi';
import MidiStatus from '../../components/MidiStatus';
import { decodeKeys, decodeMode } from '../../core/playback/playbackScopeSerializer';
import { nextQuestion as pickNextQuestion } from '../../core/playback/playbackSource';
import { keyInfo, pitchToMidi } from '../../core/playback/playbackKeys';
import { targetSequence, pitchClassOf, evaluateSequence } from '../../core/playback/melodyMatch';
import type { PlaybackQuestion, MelodyNote } from '../../core/playback/playbackTypes';

/** Accent color for the playback module. */
const ACCENT = '#0ea5e9';

/**
 * Human-readable label for a bank question id, e.g. "Final_01" → "Final 1",
 * "Weekly_03" → "Weekly 3". Returns null for non-bank (generated) ids so the
 * label only shows in bank mode.
 */
function bankLabel(id: string): string | null {
  const m = id.match(/^(Final|Weekly)_0*(\d+)$/);
  if (!m) return null;
  return `${m[1]} ${m[2]}`;
}

// ============================================================
// VexFlow helpers
// ============================================================

/** Parse a spelled pitch into a VexFlow key + letter + accidental symbol. */
function parsePitch(pitchStr: string): { key: string; letter: string; accidental: string } {
  const m = pitchStr.match(/^([A-Ga-g])(##|bb|#|b)?(\d)$/);
  if (!m) return { key: 'c/4', letter: 'C', accidental: '' };
  return { key: `${m[1].toLowerCase()}/${m[3]}`, letter: m[1].toUpperCase(), accidental: m[2] || '' };
}

/** Which accidental symbol (if any) to draw under a key signature. */
function accidentalToDraw(letter: string, accidental: string, sig: Record<string, string>): string | null {
  const sigAcc = sig[letter] ?? '';
  if (accidental === sigAcc) return null;
  if (accidental === '') return 'n';
  return accidental;
}

/** Map a beat duration to a VexFlow duration code + dotted flag. */
function beatsToDuration(beats: number): { duration: string; dots: number } {
  switch (beats) {
    case 0.5: return { duration: '8', dots: 0 };
    case 1: return { duration: 'q', dots: 0 };
    case 1.5: return { duration: 'q', dots: 1 };
    case 2: return { duration: 'h', dots: 0 };
    case 3: return { duration: 'h', dots: 1 };
    case 4: return { duration: 'w', dots: 0 };
    default: return { duration: 'q', dots: 0 };
  }
}

/**
 * Group consecutive eighth notes (beats === 0.5) into beam runs, so eighths
 * beam together and other durations break the beam. Parallel arrays: `notes`
 * are the VexFlow StaveNotes and `melody` the source notes (for durations).
 */
function groupEighthRuns(notes: StaveNote[], melody: MelodyNote[]): StaveNote[][] {
  const groups: StaveNote[][] = [];
  let run: StaveNote[] = [];
  notes.forEach((note, i) => {
    if (melody[i].beats === 0.5) {
      run.push(note);
    } else {
      if (run.length) groups.push(run);
      run = [];
    }
  });
  if (run.length) groups.push(run);
  return groups;
}

/** Split the melody into measures by beat capacity. */
function splitIntoMeasures(melody: MelodyNote[], beatsPerMeasure: number): MelodyNote[][] {
  const measures: MelodyNote[][] = [];
  let current: MelodyNote[] = [];
  let acc = 0;
  for (const note of melody) {
    current.push(note);
    acc += note.beats;
    if (acc >= beatsPerMeasure - 0.001) {
      measures.push(current);
      current = [];
      acc = 0;
    }
  }
  if (current.length > 0) measures.push(current);
  return measures;
}

// ============================================================
// Component
// ============================================================

export default function PlaybackPractice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const keys = useMemo(() => decodeKeys(searchParams), [searchParams]);
  const mode = useMemo(() => decodeMode(searchParams), [searchParams]);
  const keysArr = useMemo(() => [...keys], [keys]);

  const [question, setQuestion] = useState<PlaybackQuestion>(() => pickNextQuestion(mode, keysArr));
  const [revealed, setRevealed] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(audioEngine.enabled);

  // MIDI matching state. MIDI listening is always on; when a keyboard is
  // connected the student can play the melody and each correct note is revealed
  // progressively on the sheet.
  const [playedCount, setPlayedCount] = useState(0);
  const [midiFeedback, setMidiFeedback] = useState<'none' | 'wrong' | 'complete'>('none');
  const playedRef = useRef<number[]>([]);
  const target = useMemo(() => targetSequence(question.melody), [question]);

  const nextQuestion = useCallback(() => {
    setQuestion(pickNextQuestion(mode, keysArr));
    setRevealed(false);
    setPlayedCount(0);
    setMidiFeedback('none');
    playedRef.current = [];
    audioEngine.stop();
  }, [mode, keysArr]);

  // MIDI note-on handler: append pitch class, evaluate against the target, and
  // progressively reveal matched notes on the sheet.
  const handleNoteOn = useCallback((pitch: string) => {
    const pc = pitchClassOf(pitch);
    const played = [...playedRef.current, pc];
    playedRef.current = played;
    const state = evaluateSequence(played, target);
    setPlayedCount(state.matchedCount);
    if (state.status === 'complete') {
      setMidiFeedback('complete');
      setRevealed(true);
      // Celebrate briefly (green cue), then auto-advance to the next question.
      window.setTimeout(() => nextQuestion(), 1000);
    } else if (state.status === 'wrong') {
      setMidiFeedback('wrong');
      // Reset the attempt so the student can try again from the top.
      playedRef.current = [];
      setPlayedCount(0);
      setTimeout(() => setMidiFeedback('none'), 800);
    } else {
      setMidiFeedback('none');
    }
  }, [target, nextQuestion]);

  // MIDI is always listening so a connected keyboard works without a toggle.
  const midi = useMidi({ enabled: true, onNoteOn: handleNoteOn });
  const midiConnected = midi.status === 'connected';

  const ensureAudioOn = () => {
    if (!audioEngine.enabled) {
      audioEngine.setEnabled(true);
      setAudioEnabled(true);
    }
    void audioEngine.prime();
  };

  const onPlayTonic = () => { ensureAudioOn(); playTonic(question.tonic); };
  const onPlayMelody = () => { ensureAudioOn(); playMelody(question.melody); };

  // How many melody notes are visible: the full melody once the answer is
  // revealed, otherwise just the notes matched so far via MIDI (progressive
  // reveal). When nothing is visible the sheet region shows the hidden state.
  const visibleCount = revealed ? question.melody.length : playedCount;
  const sheetVisible = visibleCount > 0;

  // VexFlow rendering of the answer sheet (key signature up front, measures).
  useEffect(() => {
    if (!sheetVisible) return;
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    try {
      const sig = keyInfo(question.key);
      const beatsPerMeasure = question.meter === '3/4' ? 3 : 4;
      // Only draw the notes that should currently be visible (all when
      // revealed; the matched prefix while the student is playing via MIDI).
      const visibleMelody = question.melody.slice(0, visibleCount);
      const measures = splitIntoMeasures(visibleMelody, beatsPerMeasure);

      // Choose the clef by the melody's average pitch so low melodies (e.g. a
      // G-minor phrase voiced around G3) render in the bass clef instead of
      // piling up ledger lines below the treble staff.
      // Clef is chosen from the FULL melody (not just the visible prefix) so it
      // stays stable as notes are progressively revealed via MIDI.
      const midis = question.melody.map((n) => pitchToMidi(n.pitch));
      const avg = midis.reduce((s, m) => s + m, 0) / (midis.length || 1);
      const clef: 'treble' | 'bass' = avg < 60 ? 'bass' : 'treble';

      const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
      // Wider canvas + taller so ledger-line notes and the held final note fit.
      const width = Math.min(760, Math.max(360, containerRef.current.clientWidth - 8));
      const height = 200;
      renderer.resize(width, height);
      const context = renderer.getContext();

      // One stave holds the whole melody. Notes are laid out left→right with an
      // explicit barline (BarNote) between measures. A soft-mode voice is used
      // so irregular measure beat-totals (some bank finals are held longer)
      // never break rendering.
      const staveX = 10;
      const staveWidth = width - 2 * staveX;
      const stave = new Stave(staveX, 55, staveWidth);
      stave.addClef(clef);
      stave.addKeySignature(sig.vexKeySpec);
      stave.addTimeSignature(question.meter);
      stave.setContext(context).draw();

      // Build StaveNotes per measure (so beams stay within a measure) and
      // interleave a BarNote between measures.
      const tickables: (StaveNote | BarNote)[] = [];
      const beamGroups: StaveNote[][] = [];

      measures.forEach((measureNotes, mi) => {
        if (mi > 0) tickables.push(new BarNote());
        const staveNotes = measureNotes.map((n) => {
          const p = parsePitch(n.pitch);
          const { duration, dots } = beatsToDuration(n.beats);
          // Notes at/above the middle staff line get a downward stem; notes
          // below it get an upward stem (standard engraving). Middle line is
          // B4 (MIDI 71) in treble, D3 (MIDI 50) in bass.
          const middleMidi = clef === 'bass' ? 50 : 71;
          const stemDirection = pitchToMidi(n.pitch) >= middleMidi ? Stem.DOWN : Stem.UP;
          // Dotted durations use the base duration + a `d` modifier in the
          // duration string AND an attached Dot so the dot glyph actually draws.
          const note = new StaveNote({ keys: [p.key], duration: duration + (dots ? 'd' : ''), clef, stemDirection });
          const acc = accidentalToDraw(p.letter, p.accidental, sig.perLetter);
          if (acc) note.addModifier(new Accidental(acc), 0);
          for (let d = 0; d < dots; d += 1) Dot.buildAndAttach([note], { all: true });
          return note;
        });
        tickables.push(...staveNotes);
        // Beam consecutive eighth notes within this measure.
        beamGroups.push(...groupEighthRuns(staveNotes, measureNotes));
      });

      // Soft voice: total ticks are whatever the melody sums to (no strict
      // per-measure validation), so held final notes render cleanly.
      const totalBeats = visibleMelody.reduce((s, n) => s + n.beats, 0);
      const voice = new Voice({ numBeats: Math.ceil(totalBeats) + 1, beatValue: 4 }).setStrict(false);
      voice.addTickables(tickables);

      // Beam each eighth-run with autoStem=true so VexFlow computes one correct
      // stem direction (and thus the correct stem SIDE) for the whole group,
      // rather than honoring the notes' individual, possibly-conflicting stems.
      const beams = beamGroups
        .filter((g) => g.length >= 2)
        .map((g) => new Beam(g, true));

      // Format the notes to fit within the stave's note area (after the
      // clef/key/time signature "modifier" region, before the right edge), so
      // nothing overflows the stave.
      const noteAreaWidth = stave.getNoteEndX() - stave.getNoteStartX() - 20;
      new Formatter().joinVoices([voice]).format([voice], Math.max(120, noteAreaWidth));
      voice.draw(context, stave);
      beams.forEach((b) => b.setContext(context).draw());
    } catch (e) {
      console.error('VexFlow error:', e);
    }
  }, [sheetVisible, visibleCount, question]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', transition: 'background 0.5s ease',
      background: midiFeedback === 'complete' ? '#ecfdf5' : 'transparent' }}>
      <header className="quiz-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'white', border: '1px solid #e5e7eb', padding: '8px 16px', borderRadius: '20px', fontSize: '1rem', cursor: 'pointer', color: '#6b7280', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
        >
          退出练习
        </button>
        <button
          onClick={() => { audioEngine.setEnabled(!audioEngine.enabled); if (audioEngine.enabled) void audioEngine.prime(); setAudioEnabled(audioEngine.enabled); }}
          title={audioEnabled ? '关闭音效' : '开启音效'}
          style={{ background: audioEnabled ? '#f0f9ff' : 'white', border: `1px solid ${audioEnabled ? '#bae6fd' : '#e5e7eb'}`, borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: audioEnabled ? ACCENT : '#9ca3af' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            {audioEnabled
              ? (<><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></>)
              : (<><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>)}
          </svg>
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '28px' }}>
        {/* Always-visible key + time signature (+ bank question id) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
            {question.key} &nbsp;{question.meter}
          </div>
          {mode === 'bank' && bankLabel(question.id) && (
            <span
              data-testid="playback-bank-id"
              style={{ fontSize: '0.85rem', fontWeight: '700', color: ACCENT, background: `${ACCENT}12`, border: `1px solid ${ACCENT}40`, borderRadius: '12px', padding: '3px 12px' }}
            >
              题库 · {bankLabel(question.id)}
            </span>
          )}
        </div>

        {/* Two speakers: tonic chord + melody */}
        <div style={{ display: 'flex', gap: '48px' }}>
          {([
            { label: '主和弦', title: '播放主和弦', onClick: onPlayTonic },
            { label: '旋律', title: '播放旋律', onClick: onPlayMelody },
          ] as const).map(({ label, title, onClick }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={onClick}
                title={title}
                aria-label={title}
                style={{ background: `${ACCENT}12`, border: `2px solid ${ACCENT}`, borderRadius: '50%', width: '76px', height: '76px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, transition: 'all 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.94)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
              </button>
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#6b7280' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Answer sheet: shows the full melody once revealed, or the notes
            matched so far while the student plays via MIDI. */}
        <div style={{ minHeight: '190px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          {sheetVisible ? (
            <div
              ref={containerRef}
              data-testid="playback-notation"
              style={{ background: 'white', borderRadius: '16px', padding: '8px 12px', boxShadow: '0 6px 24px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}
            />
          ) : (
            <div style={{ color: '#9ca3af', fontSize: '0.95rem' }}>答案已隐藏</div>
          )}

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              style={{ padding: '10px 22px', borderRadius: '20px', border: `2px solid ${ACCENT}`, background: revealed ? `${ACCENT}12` : 'white', color: ACCENT, fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}
            >
              {revealed ? '隐藏答案' : '显示答案'}
            </button>

            <button
              type="button"
              onClick={nextQuestion}
              style={{ padding: '10px 22px', borderRadius: '20px', border: 'none', background: ACCENT, color: 'white', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', boxShadow: `0 6px 18px ${ACCENT}40` }}
            >
              下一题 →
            </button>
          </div>

          {/* MIDI: auto-detect. When connected, show live progress; when not,
              show a hint that a MIDI keyboard can be used to answer. */}
          {midiConnected ? (
            <div data-testid="playback-midi-progress" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <MidiStatus status={midi.status} deviceName={midi.deviceName} error={midi.error} />
              {midiFeedback === 'complete' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <div style={{ fontSize: '2rem', lineHeight: 1 }}>🎉</div>
                  <div style={{ fontSize: '1rem', fontWeight: '800', color: '#16a34a' }}>全部弹对！进入下一题…</div>
                </div>
              ) : (
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: midiFeedback === 'wrong' ? '#ef4444' : '#6b7280' }}>
                  {midiFeedback === 'wrong'
                    ? '弹错了，请从头再来'
                    : `已弹对 ${playedCount} / ${target.length} 个音`}
                </div>
              )}
            </div>
          ) : (
            <div data-testid="playback-midi-hint" style={{ fontSize: '0.85rem', color: '#9ca3af', textAlign: 'center' }}>
              连接 MIDI 键盘即可直接弹奏作答，弹对的音会逐个显示在乐谱上
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
