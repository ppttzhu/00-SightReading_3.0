import { describe, it, expect } from 'vitest';
import { areSlicesDuplicate, type Slice } from './useAppStore';

describe('areSlicesDuplicate — A-type placement-aware dedup', () => {
  function aSlice(pitch: string, placement?: string): Slice {
    return {
      id: 'test',
      type: 'A',
      content: { pitch, raw: pitch, placement },
      difficulty: 1,
    };
  }

  it('同一音高不同谱号 → 不是重复', () => {
    expect(areSlicesDuplicate(aSlice('C4', 'treble'), aSlice('C4', 'bass'))).toBe(false);
    expect(areSlicesDuplicate(aSlice('G3', 'treble'), aSlice('G3', 'bass'))).toBe(false);
  });

  it('同一音高同一谱号 → 是重复', () => {
    expect(areSlicesDuplicate(aSlice('C4', 'treble'), aSlice('C4', 'treble'))).toBe(true);
    expect(areSlicesDuplicate(aSlice('F5', 'bass'), aSlice('F5', 'bass'))).toBe(true);
  });

  it('旧数据无 placement + 新数据推断谱号一致 → 是重复', () => {
    // C4 无 placement → getGrandStaffPlacement('C4') === 'treble'（>= B3）
    const oldSlice = aSlice('C4');
    expect(areSlicesDuplicate(oldSlice, aSlice('C4', 'treble'))).toBe(true);
    expect(areSlicesDuplicate(aSlice('C4', 'treble'), oldSlice)).toBe(true);
  });

  it('旧数据无 placement + 新数据推断谱号不同 → 不是重复', () => {
    // A2 无 placement → getGrandStaffPlacement('A2') === 'bass'（< B3）
    // 但人为指定为 treble → 不同，保留两份
    expect(areSlicesDuplicate(aSlice('A2'), aSlice('A2', 'treble'))).toBe(false);
    expect(areSlicesDuplicate(aSlice('A2', 'bass'), aSlice('A2', 'treble'))).toBe(false);
  });

  it('B/C/D 类型仍只比较 content key，不受 placement 影响', () => {
    const b1: Slice = { id: 'b1', type: 'B', content: { symbol: 'ff', raw: 'ff' }, difficulty: 1 };
    const b2: Slice = { id: 'b2', type: 'B', content: { symbol: 'ff', raw: 'ff' }, difficulty: 2 };
    expect(areSlicesDuplicate(b1, b2)).toBe(true);

    const c1: Slice = { id: 'c1', type: 'C', content: { theory: '纯五度', raw: '纯五度' }, difficulty: 1 };
    const c2: Slice = { id: 'c2', type: 'C', content: { theory: '纯四度', raw: '纯四度' }, difficulty: 1 };
    expect(areSlicesDuplicate(c1, c2)).toBe(false);
  });
});
