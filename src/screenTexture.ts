import * as THREE from 'three';

export type FitMode = 'stretch' | 'cover' | 'contain';

export const FIT_MODES: FitMode[] = ['stretch', 'cover', 'contain'];

export function isFitMode(value: string): value is FitMode {
  return (FIT_MODES as string[]).includes(value);
}

/** Longest edge of the intermediate canvas. */
const MAX_EDGE = 2048;

/**
 * Draws the picture into a canvas shaped like the screen, then wraps it as a
 * texture. Routing all three fit modes through one canvas keeps them uniform —
 * in particular `contain`, whose letterbox bars texture repeat/offset cannot
 * express at all (clamped wrapping smears edge pixels instead).
 *
 * The bars are painted opaque black: a device screen showing a letterboxed
 * picture reads as black bars, and it keeps the exported device solid rather
 * than punching a hole through to the transparent background.
 */
export function createScreenTexture(
  image: ImageBitmap,
  screenAspect: number,
  fit: FitMode,
): THREE.CanvasTexture {
  const { width, height } = canvasSize(image, screenAspect);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D context for the screen texture.');
  ctx.imageSmoothingQuality = 'high';

  if (fit === 'contain') {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
  }

  const { dx, dy, dw, dh } = placement(image, width, height, fit);
  ctx.drawImage(image, dx, dy, dw, dh);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // glTF UVs assume unflipped textures, unlike Three's default for canvases.
  // Without this the picture renders upside down.
  texture.flipY = false;
  texture.anisotropy = 8;
  return texture;
}

/** Decodes a dropped or picked file, honouring any EXIF orientation. */
export function loadImageFromBlob(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: 'from-image' });
}

export async function loadImageFromUrl(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
  return loadImageFromBlob(await response.blob());
}

function canvasSize(image: ImageBitmap, screenAspect: number) {
  let width: number;
  let height: number;
  if (screenAspect >= 1) {
    width = MAX_EDGE;
    height = Math.round(MAX_EDGE / screenAspect);
  } else {
    height = MAX_EDGE;
    width = Math.round(MAX_EDGE * screenAspect);
  }

  // Don't burn memory upscaling a small source image.
  const scale = Math.min(1, Math.max(image.width, image.height) / MAX_EDGE);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function placement(image: ImageBitmap, width: number, height: number, fit: FitMode) {
  if (fit === 'stretch') {
    return { dx: 0, dy: 0, dw: width, dh: height };
  }

  const scale =
    fit === 'cover'
      ? Math.max(width / image.width, height / image.height)
      : Math.min(width / image.width, height / image.height);

  const dw = image.width * scale;
  const dh = image.height * scale;
  return { dx: (width - dw) / 2, dy: (height - dh) / 2, dw, dh };
}
