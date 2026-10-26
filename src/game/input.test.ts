import { describe, expect, it } from 'vitest';
import { classifySwipe } from './input';

describe('classifySwipe', () => {
  it('ignores short touches', () => {
    expect(classifySwipe(5, 5, 18)).toBeNull();
  });

  it('picks the swipe’s main axis', () => {
    expect(classifySwipe(30, 4, 18)).toBe('horizontal');
    expect(classifySwipe(-30, 10, 18)).toBe('horizontal');
    expect(classifySwipe(3, -25, 18)).toBe('vertical');
  });
});
