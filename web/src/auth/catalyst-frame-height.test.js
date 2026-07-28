import { describe, expect, test } from 'vitest';

import {
  CATALYST_FRAME_FALLBACK_HEIGHT,
  applyCatalystFrameHeight,
  measureCatalystFrameHeight,
} from './catalyst-frame-height.js';

const frameWithHeight = height => ({
  contentDocument: {
    body: { scrollHeight: height - 4 },
    documentElement: { scrollHeight: height },
  },
});

describe('Catalyst frame height', () => {
  test('uses a compact bounded height for the email step', () => {
    expect(measureCatalystFrameHeight(frameWithHeight(270))).toBe(282);
  });

  test('expands and clamps tall password or error states', () => {
    expect(measureCatalystFrameHeight(frameWithHeight(330))).toBe(342);
    expect(measureCatalystFrameHeight(frameWithHeight(900))).toBe(360);
  });

  test('returns the safe fallback when iframe access is unavailable', () => {
    const frame = {};
    Object.defineProperty(frame, 'contentDocument', {
      get: () => { throw new DOMException('Blocked'); },
    });

    expect(measureCatalystFrameHeight(frame)).toBe(CATALYST_FRAME_FALLBACK_HEIGHT);
  });

  test('applies one shared custom property to the host', () => {
    const host = document.createElement('div');

    expect(applyCatalystFrameHeight(host, frameWithHeight(270))).toBe(282);
    expect(host.style.getPropertyValue('--catalyst-frame-height')).toBe('282px');
  });
});
