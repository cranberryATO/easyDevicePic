import { t } from './i18n';
import type { Viewer } from './scene';

/** The device's longer side in the exported PNG. */
export const EXPORT_MAX_EDGE = 1080;

/** The measurement pass runs at this fraction of the viewport, per axis. */
const MEASURE_DIVISOR = 3;

/**
 * Safety caps on the full-resolution frame. Targeting the longer side keeps the
 * frame bounded whatever the device's orientation, but a device left small in
 * the frame — zoomed well out — can still ask for more than a GPU will give.
 */
const MAX_FRAME_EDGE = 8192;
const MAX_FRAME_PIXELS = 24e6;

/**
 * Renders the scene on a transparent background, cropped to the device, and
 * hands the PNG to the browser's downloader.
 *
 * Two passes. The first is a cheap render at a third of the viewport, used only
 * to find the rectangle the device occupies — a ninth of the pixels to read
 * back and scan. That rectangle says how much of the frame the device actually
 * fills, which gives the scale the real render needs for the device's longer
 * side to come out at `maxEdge`. The second pass renders at that scale and the
 * rectangle is copied straight out of it.
 *
 * Copying the rectangle with `drawImage` (rather than reading the whole frame
 * back and trimming it) means the large render is never pulled into JS memory,
 * and lets the browser un-premultiply the alpha — which is what keeps the
 * device edges free of a dark fringe.
 *
 * The rectangle is quantised to the measurement pass's pixels, so the crop
 * keeps a few pixels of transparent margin. That is deliberate: erring outwards
 * leaves a margin, erring inwards would clip the device.
 */
export async function downloadScenePng(
  viewer: Viewer,
  filename: string,
  maxEdge = EXPORT_MAX_EDGE,
): Promise<void> {
  const { renderer, camera, canvas } = viewer;
  const displayWidth = canvas.clientWidth || 1;
  const displayHeight = canvas.clientHeight || 1;
  const previousPixelRatio = renderer.getPixelRatio();

  try {
    renderer.setPixelRatio(1);

    // --- pass 1: locate the device ------------------------------------------
    const lowWidth = Math.max(1, Math.round(displayWidth / MEASURE_DIVISOR));
    const lowHeight = Math.max(1, Math.round(displayHeight / MEASURE_DIVISOR));
    renderer.setSize(lowWidth, lowHeight, false);
    camera.aspect = lowWidth / lowHeight;
    camera.updateProjectionMatrix();
    viewer.renderNow();

    const bounds = measureContentBounds(canvas);
    if (!bounds) throw new Error(t('export.empty'));

    // Grow by one measurement pixel on each side: that is exactly the
    // quantisation error, so the device cannot end up clipped.
    const left = Math.max(0, bounds.minX - 1);
    const top = Math.max(0, bounds.minY - 1);
    const right = Math.min(lowWidth - 1, bounds.maxX + 1);
    const bottom = Math.min(lowHeight - 1, bounds.maxY + 1);
    const boxWidth = right - left + 1;
    const boxHeight = bottom - top + 1;

    // --- pass 2: the real render --------------------------------------------
    // Scaling both axes by the same factor keeps the framing identical to the
    // measurement pass, which is what makes the rectangle transferable.
    let scale = clampScale(maxEdge / Math.max(boxWidth, boxHeight), lowWidth, lowHeight, renderer);
    const gl = renderer.getContext();
    let frameWidth = 0;
    let frameHeight = 0;

    // Settle on a size the context will actually allocate, before rendering
    // anything. Asked for too much, WebGL does not fail — it quietly hands back
    // a smaller drawing buffer, and the crop rectangle would then point at the
    // wrong pixels. The caps above are only a guess at the limit: it varies by
    // device (mobile GPUs allow far less) and cannot be queried directly, so
    // the buffer itself is the authority. `drawingBufferWidth` is accurate as
    // soon as the canvas is resized, so a rejected size costs no render.
    for (let attempt = 0; ; attempt++) {
      frameWidth = Math.max(1, Math.round(lowWidth * scale));
      frameHeight = Math.max(1, Math.round(lowHeight * scale));
      renderer.setSize(frameWidth, frameHeight, false);

      const allocated =
        gl.drawingBufferWidth === frameWidth && gl.drawingBufferHeight === frameHeight;
      if (allocated || scale <= 1 || attempt >= 4) break;
      scale = Math.max(1, scale * 0.7);
    }

    camera.aspect = frameWidth / frameHeight;
    camera.updateProjectionMatrix();
    viewer.renderNow();

    // Map with the ratios actually used rather than `scale`, so the rounding
    // of the frame size cannot make the rectangle drift. Rounding outwards
    // again keeps the error on the margin side.
    const sx = Math.floor((left * frameWidth) / lowWidth);
    const sy = Math.floor((top * frameHeight) / lowHeight);
    const sw = Math.min(frameWidth - sx, Math.ceil((boxWidth * frameWidth) / lowWidth));
    const sh = Math.min(frameHeight - sy, Math.ceil((boxHeight * frameHeight) / lowHeight));

    const output = document.createElement('canvas');
    output.width = sw;
    output.height = sh;
    const context = output.getContext('2d');
    if (!context) throw new Error(t('export.failed'));
    context.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error(t('export.failed'));

    triggerDownload(blob, filename);
  } finally {
    renderer.setPixelRatio(previousPixelRatio);
    renderer.setSize(displayWidth, displayHeight, false);
    camera.aspect = displayWidth / displayHeight;
    camera.updateProjectionMatrix();
    viewer.renderNow();
  }
}

/** Keeps the requested scale inside what the GPU and the caps allow. */
function clampScale(
  requested: number,
  lowWidth: number,
  lowHeight: number,
  renderer: Viewer['renderer'],
): number {
  const frameEdgeLimit = Math.min(MAX_FRAME_EDGE, renderer.capabilities.maxTextureSize);
  const byEdge = Math.min(frameEdgeLimit / lowWidth, frameEdgeLimit / lowHeight);
  const byArea = Math.sqrt(MAX_FRAME_PIXELS / (lowWidth * lowHeight));
  // Never below 1: the export should not come out coarser than the probe.
  return Math.max(1, Math.min(requested, byEdge, byArea));
}

/**
 * The bounding box of everything that is not fully transparent, or null when
 * the frame is empty. Only alpha exactly 0 counts as background, so the
 * anti-aliased edge is treated as content.
 */
function measureContentBounds(
  source: HTMLCanvasElement,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const { width, height } = source;

  const probe = document.createElement('canvas');
  probe.width = width;
  probe.height = height;
  const context = probe.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error(t('export.failed'));
  context.drawImage(source, 0, 0);

  const { data } = context.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      maxY = y;
    }
  }

  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
