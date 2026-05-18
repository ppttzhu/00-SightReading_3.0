import type { Slice } from '../store/useAppStore';
import type { AttemptCategory } from './questionTracker';

export function labelFromSlice(slice: Slice): { label: string; category: AttemptCategory } {
  switch (slice.type) {
    case 'A': {
      const pitch = slice.content.pitch || '';
      const letter = pitch.charAt(0).toUpperCase();
      return { label: pitch || letter, category: 'note' };
    }
    case 'B': {
      const label = slice.content.symbol || slice.content.raw || slice.content.answer || '记号';
      return { label, category: 'symbol' };
    }
    case 'C': {
      const label = slice.content.theory || slice.content.raw || '乐理';
      return { label, category: 'interval' };
    }
    case 'D': {
      const label = slice.content.pattern || slice.content.raw || '音型';
      return { label, category: 'pattern' };
    }
    default:
      return { label: '题目', category: 'other' };
  }
}

export function labelFromPitch(pitch: string): { label: string; category: AttemptCategory } {
  return { label: pitch, category: 'note' };
}

export function labelFromInterval(intervalName: string): { label: string; category: AttemptCategory } {
  return { label: intervalName, category: 'interval' };
}
