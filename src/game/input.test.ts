import { describe, expect, it } from 'vitest';
import { classifySwipe, toLocal } from './input';

describe('toLocal', () => {
  const rect = { left: 0, top: 0, right: 400, bottom: 700 };
  it('is a plain offset in landscape', () => {
    expect(toLocal(30, 40, { left: 10, top: 20, right: 0, bottom: 0 }, 0)).toEqual({ x: 20, y: 20 });
  });

  it('undoes the 90° clockwise turn in portrait', () => {
    // The element's top-left corner is drawn at the screen's top-right.
    expect(toLocal(400, 0, rect, 90)).toEqual({ x: 0, y: 0 });
    // Moving down the screen moves along the element's x axis…
    expect(toLocal(400, 100, rect, 90)).toEqual({ x: 100, y: 0 });
    // …and moving left on screen moves down the element's y axis.
    expect(toLocal(300, 0, rect, 90)).toEqual({ x: 0, y: 100 });
  });

  it('undoes the 90° anticlockwise turn when the phone is held the other way', () => {
    // The element's top-left corner is drawn at the screen's bottom-left.
    expect(toLocal(0, 700, rect, -90)).toEqual({ x: 0, y: 0 });
    // Moving up the screen moves along the element's x axis…
    expect(toLocal(0, 600, rect, -90)).toEqual({ x: 100, y: 0 });
    // …and moving right on screen moves down the element's y axis.
    expect(toLocal(100, 700, rect, -90)).toEqual({ x: 0, y: 100 });
  });
});

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
