import type { Viewer } from './scene';

export const EXPORT_WIDTH = 2000;

/** Height the export will produce for the current window shape. */
export function exportHeightFor(viewer: Viewer, width = EXPORT_WIDTH): number {
  const aspect = (viewer.canvas.clientWidth || 1) / (viewer.canvas.clientHeight || 1);
  return Math.max(1, Math.round(width / aspect));
}

/**
 * Renders the scene at a fixed width with a transparent background and hands
 * the PNG to the browser's downloader.
 *
 * The canvas is resized in place with `updateStyle: false` — the CSS size is
 * untouched, so the page doesn't visibly jump — and because the aspect ratio is
 * preserved, the export frames exactly what is on screen. Reading back through
 * `canvas.toBlob` (rather than `readRenderTargetPixels`) lets the browser
 * un-premultiply the alpha, which is what keeps the device edges free of a dark
 * fringe.
 */
export async function downloadScenePng(
  viewer: Viewer,
  filename: string,
  width = EXPORT_WIDTH,
): Promise<void> {
  const { renderer, camera, canvas } = viewer;
  const displayWidth = canvas.clientWidth || 1;
  const displayHeight = canvas.clientHeight || 1;
  const height = exportHeightFor(viewer, width);
  const previousPixelRatio = renderer.getPixelRatio();

  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    viewer.renderNow();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob) throw new Error('The browser could not encode the render as a PNG.');

    triggerDownload(blob, filename);
  } finally {
    renderer.setPixelRatio(previousPixelRatio);
    renderer.setSize(displayWidth, displayHeight, false);
    camera.aspect = displayWidth / displayHeight;
    camera.updateProjectionMatrix();
    viewer.renderNow();
  }
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
