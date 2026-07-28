export const CATALYST_FRAME_MIN_HEIGHT = 250;
export const CATALYST_FRAME_MAX_HEIGHT = 360;
export const CATALYST_FRAME_FALLBACK_HEIGHT = 360;

const CATALYST_FRAME_PADDING = 12;

const clamp = value => Math.min(
  CATALYST_FRAME_MAX_HEIGHT,
  Math.max(CATALYST_FRAME_MIN_HEIGHT, value),
);

export function measureCatalystFrameHeight(frame) {
  try {
    const document = frame?.contentDocument;
    if (!document) return CATALYST_FRAME_FALLBACK_HEIGHT;

    const height = Math.max(
      Number(document.documentElement?.scrollHeight) || 0,
      Number(document.body?.scrollHeight) || 0,
    );
    if (!height) return CATALYST_FRAME_FALLBACK_HEIGHT;

    return clamp(Math.ceil(height) + CATALYST_FRAME_PADDING);
  } catch {
    return CATALYST_FRAME_FALLBACK_HEIGHT;
  }
}

export function applyCatalystFrameHeight(host, frame) {
  const height = measureCatalystFrameHeight(frame);
  host.style.setProperty('--catalyst-frame-height', `${height}px`);
  return height;
}
