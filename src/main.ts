import './style.css';
import { createViewer } from './scene';
import { disposeDevice, loadDevice, type Device } from './device';
import { DEFAULT_MODEL_ID, MODELS, PLACEHOLDER_IMAGE_URL, getModel } from './models';
import {
  createScreenTexture,
  isFitMode,
  loadImageFromBlob,
  loadImageFromUrl,
  type FitMode,
} from './screenTexture';
import { createRotationController, ROTATION_LIMITS, type RotationState } from './rotation';
import { EXPORT_WIDTH, downloadScenePng, exportHeightFor } from './exportPng';
import { createDropZone, createErrorBanner, createSegmentedControl, element } from './ui';

const canvas = element<HTMLCanvasElement>('scene');
const modelSelect = element<HTMLSelectElement>('model');
const fileInput = element<HTMLInputElement>('file');
const pickButton = element<HTMLButtonElement>('pick');
const resetButton = element<HTMLButtonElement>('reset');
const downloadButton = element<HTMLButtonElement>('download');
const exportSizeLabel = element('export-size');
const errors = createErrorBanner(element('error'));

const sliders: Record<keyof RotationState, HTMLInputElement> = {
  x: element<HTMLInputElement>('rot-x'),
  y: element<HTMLInputElement>('rot-y'),
  z: element<HTMLInputElement>('rot-z'),
};
const readouts: Record<keyof RotationState, HTMLOutputElement> = {
  x: element<HTMLOutputElement>('rot-x-out'),
  y: element<HTMLOutputElement>('rot-y-out'),
  z: element<HTMLOutputElement>('rot-z-out'),
};

const viewer = createViewer(canvas);

let device: Device | null = null;
let picture: ImageBitmap | null = null;
let fit: FitMode = 'stretch';

const rotation = createRotationController({
  target: viewer.pivot,
  domElement: canvas,
  onChange: (state) => {
    syncSliders(state);
    viewer.requestRender();
  },
});

function syncSliders(state: RotationState) {
  for (const axis of ['x', 'y', 'z'] as const) {
    const degrees = Math.round(state[axis]);
    sliders[axis].value = String(degrees);
    readouts[axis].textContent = `${degrees}°`;
  }
}

/** Rebuilds the screen texture from the current picture and fit mode. */
function applyPicture() {
  if (!device || !picture) return;
  const previous = device.screenMaterial.map;
  device.screenMaterial.map = createScreenTexture(picture, device.screenAspect, fit);
  device.screenMaterial.needsUpdate = true;
  previous?.dispose();
  viewer.requestRender();
}

async function setPicture(source: Blob) {
  try {
    const next = await loadImageFromBlob(source);
    picture?.close();
    picture = next;
    errors.clear();
    applyPicture();
  } catch (error) {
    errors.show(error);
  }
}

async function setModel(id: string) {
  modelSelect.disabled = true;
  downloadButton.disabled = true;
  try {
    const next = await loadDevice(getModel(id));
    if (device) {
      viewer.pivot.remove(device.root);
      disposeDevice(device);
    }
    device = next;
    viewer.pivot.add(device.root);
    viewer.frameRadius(device.radius);
    applyPicture();
    errors.clear();
    downloadButton.disabled = false;
  } catch (error) {
    errors.show(error);
  } finally {
    modelSelect.disabled = false;
    modelSelect.value = device ? id : modelSelect.value;
  }
}

function updateExportSizeLabel() {
  exportSizeLabel.textContent = `${EXPORT_WIDTH} × ${exportHeightFor(viewer)} px, transparent background`;
}

// --- wiring ---------------------------------------------------------------

for (const model of MODELS) {
  const option = document.createElement('option');
  option.value = model.id;
  option.textContent = model.label;
  modelSelect.append(option);
}
modelSelect.value = DEFAULT_MODEL_ID;
modelSelect.addEventListener('change', () => void setModel(modelSelect.value));

for (const axis of ['x', 'y', 'z'] as const) {
  sliders[axis].min = String(-ROTATION_LIMITS[axis]);
  sliders[axis].max = String(ROTATION_LIMITS[axis]);
  sliders[axis].addEventListener('input', () => {
    rotation.set({ [axis]: Number(sliders[axis].value) });
  });
}
resetButton.addEventListener('click', () => rotation.reset());

createSegmentedControl(element('fit'), (value) => {
  if (!isFitMode(value)) return;
  fit = value;
  applyPicture();
});

pickButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void setPicture(file);
  fileInput.value = '';
});

createDropZone({
  overlay: element('drop-overlay'),
  onFile: (file) => void setPicture(file),
  onReject: (message) => errors.show(new Error(message)),
});

downloadButton.addEventListener('click', async () => {
  downloadButton.disabled = true;
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    await downloadScenePng(viewer, `easydevicepic-${modelSelect.value}-${stamp}.png`);
  } catch (error) {
    errors.show(error);
  } finally {
    downloadButton.disabled = !device;
  }
});

window.addEventListener('resize', updateExportSizeLabel);
updateExportSizeLabel();
syncSliders(rotation.get());

// --- boot -----------------------------------------------------------------

void (async () => {
  // The placeholder and the model load in parallel; whichever lands second
  // triggers the first render with both in place.
  const [placeholder] = await Promise.allSettled([
    loadImageFromUrl(PLACEHOLDER_IMAGE_URL),
    setModel(DEFAULT_MODEL_ID),
  ]);

  if (placeholder.status === 'fulfilled') {
    picture = placeholder.value;
    applyPicture();
  } else {
    errors.show(
      new Error(
        `Could not load the placeholder image from public/${PLACEHOLDER_IMAGE_URL} — ` +
          `${placeholder.reason}`,
      ),
    );
  }
})();
