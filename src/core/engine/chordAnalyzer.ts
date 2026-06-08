/**
 * Chord Analyzer Engine
 *
 * Takes a list of pitch strings (e.g. ['C4', 'E4', 'G4']) and identifies
 * the chord (root + quality). Handles broken chords (arpeggios) by
 * normalising to pitch-class sets. The output chord name's letter spelling
 * is derived from the input pitches' letter names, not from pitch-class
 * numbers alone (e.g. Db4,F4,Ab4 → "Db Major", never "C# Major").
 */

// ── Chord quality templates (intervals in semitones from root) ──────────

export interface ChordTemplate {
  quality: string;
  displayName: string;      // human-readable label
  semitones: number[];      // must be sorted ascending, starting with 0
  difficulty: number;       // base difficulty
}

export const CHORD_TEMPLATES: ChordTemplate[] = [
  // Triads
  { quality: 'Major',      displayName: 'Major',      semitones: [0, 4, 7],    difficulty: 1 },
  { quality: 'Minor',      displayName: 'Minor',      semitones: [0, 3, 7],    difficulty: 1 },
  { quality: 'Diminished', displayName: 'Diminished',  semitones: [0, 3, 6],    difficulty: 3 },
  { quality: 'Augmented',  displayName: 'Augmented',   semitones: [0, 4, 8],    difficulty: 3 },
  { quality: 'Sus2',       displayName: 'Sus2',        semitones: [0, 2, 7],    difficulty: 2 },
  { quality: 'Sus4',       displayName: 'Sus4',        semitones: [0, 5, 7],    difficulty: 2 },

  // Seventh chords
  { quality: 'Dom7',       displayName: 'Dom7',        semitones: [0, 4, 7, 10], difficulty: 4 },
  { quality: 'Maj7',       displayName: 'Maj7',        semitones: [0, 4, 7, 11], difficulty: 4 },
  { quality: 'Min7',       displayName: 'Min7',        semitones: [0, 3, 7, 10], difficulty: 4 },
  { quality: 'Dim7',       displayName: 'Dim7',        semitones: [0, 3, 6, 9],  difficulty: 5 },
  { quality: 'MinMaj7',    displayName: 'MinMaj7',     semitones: [0, 3, 7, 11], difficulty: 5 },
  { quality: 'HalfDim7',   displayName: 'HalfDim7',    semitones: [0, 3, 6, 10], difficulty: 5 },
  { quality: 'Aug7',       displayName: 'Aug7',        semitones: [0, 4, 8, 10], difficulty: 5 },
  { quality: 'Dom7sus4',   displayName: 'Dom7sus4',    semitones: [0, 5, 7, 10], difficulty: 4 },
  { quality: 'Dom7b5',     displayName: 'Dom7b5',      semitones: [0, 4, 6, 10], difficulty: 5 },
  { quality: 'Dom7#5',     displayName: 'Dom7#5',      semitones: [0, 4, 8, 10], difficulty: 5 },

  // Extended chords (5-note — note: Phase 1-2 rendering limited to 3-4 notes)
  { quality: 'Dom9',       displayName: 'Dom9',        semitones: [0, 4, 7, 10, 14], difficulty: 7 },
  { quality: 'Maj9',       displayName: 'Maj9',        semitones: [0, 4, 7, 11, 14], difficulty: 7 },
  { quality: 'Min9',       displayName: 'Min9',        semitones: [0, 3, 7, 10, 14], difficulty: 7 },

  // Sixth chords
  { quality: 'Major6',     displayName: 'Major6',      semitones: [0, 4, 7, 9],   difficulty: 4 },
  { quality: 'Minor6',     displayName: 'Minor6',      semitones: [0, 3, 7, 9],   difficulty: 4 },

  // Add9 / suspended variants
  { quality: 'Add9',       displayName: 'Add9',        semitones: [0, 2, 4, 7],   difficulty: 4 },
  { quality: 'MinAdd9',    displayName: 'MinAdd9',     semitones: [0, 2, 3, 7],   difficulty: 4 },
];

// ── Pitch-class helpers ─────────────────────────────────────────────────

/** Natural note letter → semitone offset within the octave. */
const LETTER_TO_SEMI: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/** Accidental → semitone adjustment. */
const ACCIDENTAL_ADJ: Record<string, number> = {
  '#': 1, '##': 2, 'b': -1, 'bb': -2, '': 0,
};

/** Given a letter and accidental string, return the pitch class (0-11). */
export function pitchClass(letter: string, accidental: string): number {
  const base = LETTER_TO_SEMI[letter.toUpperCase()] ?? 0;
  const adj = ACCIDENTAL_ADJ[accidental] ?? 0;
  return (base + adj + 12) % 12;
}

// ── Analysis result ────────────────────────────────────────────────────

export interface ChordAnalysis {
  root: string;          // letter + accidental, e.g. "C", "F#", "Bb"
  quality: string;       // template quality, e.g. "Major", "Min7"
  name: string;          // full display name, e.g. "C Major", "Bb Dim7"
  inversion: 'root' | '1st' | '2nd' | '3rd';
  confidence: number;    // 0-1
}

// ── Core algorithm ──────────────────────────────────────────────────────

interface ParsedNote {
  /** Full pitch string e.g. "C#4" */
  raw: string;
  /** Letter portion e.g. "C" */
  letter: string;
  /** Accidental portion e.g. "#" or "" */
  accidental: string;
  /** Octave number */
  octave: number;
  /** Pitch class 0-11 */
  pc: number;
}

function parsePitch(p: string): ParsedNote | null {
  const m = p.match(/^([A-Ga-g])(#{1,2}|b{1,2})?(\d+)$/);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const accidental = m[2] || '';
  const octave = parseInt(m[3], 10);
  return { raw: p, letter, accidental, octave, pc: pitchClass(letter, accidental) };
}

/** Try every tone in the set as the root and return the best match. */
function findBestTemplate(
  pcs: number[],
  _inversion: string | undefined,
): { template: ChordTemplate; rootPc: number; inv: 'root' | '1st' | '2nd' | '3rd' } | null {
  let best: { template: ChordTemplate; rootPc: number; inv: 'root' | '1st' | '2nd' | '3rd' } | null = null;

  for (let ri = 0; ri < pcs.length; ri++) {
    const rootPc = pcs[ri];
    // Sorted intervals from this candidate root
    const intervals = pcs
      .map(pc => (pc - rootPc + 12) % 12)
      .sort((a, b) => a - b);

    for (const tmpl of CHORD_TEMPLATES) {
      if (intervals.length !== tmpl.semitones.length) continue;
      if (intervals.every((v, i) => v === tmpl.semitones[i])) {
        const inv: 'root' | '1st' | '2nd' | '3rd' =
          ri === 0 ? 'root' : ri === 1 ? '1st' : ri === 2 ? '2nd' : '3rd';
        // Prefer root position; if inversion is explicitly requested, prefer matching
        if (!best) { best = { template: tmpl, rootPc, inv }; continue; }
        // Root position beats inversions
        if (inv === 'root' && best.inv !== 'root') { best = { template: tmpl, rootPc, inv }; }
        // Never downgrade from root
      }
    }
  }
  return best;
}

/** Derive the root letter name from the parsed input notes.
 *  Uses the note whose pitch class matches the rootPc and has the lowest
 *  octave (most likely to be the intended root). Falls back to the
 *  natural letter for that pitch class if none matches. */
function deriveRootName(rootPc: number, notes: ParsedNote[]): string {
  // Find the input note with matching pc and the lowest octave
  const candidates = notes.filter(n => n.pc === rootPc);
  if (candidates.length > 0) {
    // Lowest octave first, then prefer natural accidentals
    candidates.sort((a, b) => a.octave !== b.octave ? a.octave - b.octave : (a.accidental === '' ? -1 : 1));
    return candidates[0].letter + candidates[0].accidental;
  }
  // Fallback: map pc back to the most common spelling
  const PC_TO_NATURAL: Record<number, string> = { 0:'C',1:'C#',2:'D',3:'D#',4:'E',5:'F',6:'F#',7:'G',8:'G#',9:'A',10:'A#',11:'B' };
  return PC_TO_NATURAL[rootPc] ?? '?';
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Analyse a list of pitch strings and return chord information.
 *
 * @param pitches - e.g. `['C4', 'E4', 'G4']`
 * @param opts.requireInversion - if set, return only matches with this inversion
 * @returns analysis result, or null if no chord template matches
 */
export function analyzeChord(
  pitches: string[],
): ChordAnalysis | null {
  if (!pitches || pitches.length < 2) return null;

  // 1. Parse all pitches
  const parsed: ParsedNote[] = [];
  for (const p of pitches) {
    const n = parsePitch(p);
    if (n) parsed.push(n);
  }
  if (parsed.length < 2) return null;

  // 2. Deduplicate by pitch class (keep first occurrence's letter info)
  const seenPc = new Set<number>();
  const unique: ParsedNote[] = [];
  for (const n of parsed) {
    if (!seenPc.has(n.pc)) {
      seenPc.add(n.pc);
      unique.push(n);
    }
  }

  // 3. Sort by pitch class for consistent interval calculation
  unique.sort((a, b) => a.pc - b.pc);
  const pcs = unique.map(n => n.pc);

  // 4. Find best template match
  const match = findBestTemplate(pcs, undefined);
  if (!match) return null;

  // 5. Derive root name from input letter info
  const rootName = deriveRootName(match.rootPc, parsed);

  const quality = match.template.quality;

  // Build display name: for common qualities use a compact form
  const QUALITY_DISPLAY: Record<string, string> = {
    'Major':      '',
    'Minor':      'm',
    'Diminished': 'dim',
    'Augmented':  'aug',
    'Sus2':       'sus2',
    'Sus4':       'sus4',
    'Dom7':       '7',
    'Maj7':       'maj7',
    'Min7':       'm7',
    'Dim7':       'dim7',
    'MinMaj7':    'mM7',
    'HalfDim7':   'ø7',
    'Aug7':       'aug7',
    'Dom7sus4':   '7sus4',
    'Dom7b5':     '7b5',
    'Dom7#5':     '7#5',
    'Dom9':       '9',
    'Maj9':       'maj9',
    'Min9':       'm9',
    'Major6':     '6',
    'Minor6':     'm6',
    'Add9':       'add9',
    'MinAdd9':    'madd9',
  };
  const displaySuffix = QUALITY_DISPLAY[match.template.quality] ?? match.template.quality;
  const displayName = `${rootName}${displaySuffix}`;

  return {
    root: rootName,
    quality,
    name: displayName,
    inversion: match.inv,
    confidence: 1,
  };
}

// ── Difficulty ─────────────────────────────────────────────────────────

/**
 * Calculate the difficulty score for a chord (1-10).
 * Base from template + inversion penalty + arpeggio penalty.
 */
export function calcChordDifficulty(
  quality: string,
  inversion: string,
  displayMode: 'block' | 'arpeggio',
): number {
  const tmpl = CHORD_TEMPLATES.find(t => t.quality === quality);
  let d = tmpl?.difficulty ?? 3;
  if (inversion !== 'root') d += 1;
  if (displayMode === 'arpeggio') d += 1;
  return Math.min(10, Math.max(1, d));
}

/**
 * Return all available chord quality names (for UI lists / filters).
 */
export function getAllChordQualities(): string[] {
  return [...new Set(CHORD_TEMPLATES.map(t => t.quality))];
}

/**
 * Return all chord display names for a given set of qualities.
 */
export function getAllChordNames(): string[] {
  const ROOTS = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
  const qualitySuffix: Record<string, string> = {
    Major: '', Minor: 'm', Diminished: 'dim', Augmented: 'aug',
    Sus2: 'sus2', Sus4: 'sus4',
    Dom7: '7', Maj7: 'maj7', Min7: 'm7', Dim7: 'dim7',
    MinMaj7: 'mM7', HalfDim7: 'ø7', Aug7: 'aug7',
    'Dom7sus4': '7sus4', 'Dom7b5': '7b5', 'Dom7#5': '7#5',
    Dom9: '9', Maj9: 'maj9', Min9: 'm9',
    Major6: '6', Minor6: 'm6',
    Add9: 'add9', MinAdd9: 'madd9',
  };
  const names: string[] = [];
  for (const r of ROOTS) {
    for (const t of CHORD_TEMPLATES) {
      const suffix = qualitySuffix[t.quality] ?? t.quality;
      names.push(`${r}${suffix}`);
    }
  }
  return names;
}
