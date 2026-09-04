import './style.css';
import { createViewer } from './scene';
import { disposeDevice, loadDevice, type Device } from './device';
import { DEFAULT_MODEL_ID, MODELS, getModel } from './models';
import {
  createScreenTexture,
  isFitMode,
  loadImageFromBlob,
  loadImageFromUrl,
  type FitMode,
} from './screenTexture';
import { createRotationController, ROTATION_LIMITS, type RotationState } from './rotation';
import { downloadScenePng } from './exportPng';
import { createDropZone, createErrorBanner, createSegmentedControl, element } from './ui';
import { LOCALES, PAGES, applyTranslations, getLocale, setLocale, t } from './i18n';

const canvas = element<HTMLCanvasElement>('scene');
const modelSelect = element<HTMLSelectElement>('model');
const fileInput = element<HTMLInputElement>('file');
const pickButton = element<HTMLButtonElement>('pick');
const resetButton = element<HTMLButtonElement>('reset');
const downloadButton = element<HTMLButtonElement>('download');
const errors = createErrorBanner(element('error'));
const langSwitch = element('lang-switch');
const bylineLink = element<HTMLAnchorElement>('byline-link');
const aboutLink = element<HTMLAnchorElement>('link-about');
const privacyLink = element<HTMLAnchorElement>('link-privacy');
const legalLink = element<HTMLAnchorElement>('link-legal');

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
/** While true, changing device swaps in that device's own placeholder. */
let showingPlaceholder = true;
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
    showingPlaceholder = false;
    errors.clear();
    applyPicture();
  } catch (error) {
    errors.show(error);
  }
}

async function setModel(id: string) {
  const config = getModel(id);
  modelSelect.disabled = true;
  downloadButton.disabled = true;

  // Fetch this device's placeholder alongside its model — but only while the
  // user hasn't supplied a picture, since theirs survives a device change.
  const placeholder = showingPlaceholder ? loadImageFromUrl(config.placeholderImageUrl) : null;
  // Claim the rejection now so a placeholder 404 can't surface as an unhandled
  // rejection when the model itself fails first.
  placeholder?.catch(() => undefined);

  try {
    const next = await loadDevice(config);
    if (device) {
      viewer.pivot.remove(device.root);
      disposeDevice(device);
    }
    device = next;
    viewer.pivot.add(device.root);
    viewer.frameRadius(device.radius);
    errors.clear();
    downloadButton.disabled = false;
  } catch (error) {
    errors.show(error);
    return;
  } finally {
    modelSelect.disabled = false;
    modelSelect.value = device ? id : modelSelect.value;
  }

  if (placeholder) {
    try {
      const image = await placeholder;
      picture?.close();
      picture = image;
    } catch (error) {
      errors.show(
        new Error(
          `Loaded ${config.id}, but its placeholder image is missing.\n` +
            `Expected public/${config.placeholderImageUrl} — ${
              error instanceof Error ? error.message : String(error)
            }`,
        ),
      );
    }
  }
  applyPicture();
}

// --- localization ---------------------------------------------------------

/**
 * Re-renders everything language-dependent in place. Deliberately not a page
 * reload: that would throw away the picture the user loaded and their rotation.
 */
function applyLocale() {
  applyTranslations();

  // Option labels are built in JS, so the DOM walk in applyTranslations()
  // cannot reach them.
  for (const option of modelSelect.options) {
    const model = MODELS.find((candidate) => candidate.id === option.value);
    if (model) option.textContent = t(model.labelKey);
  }

  const pages = PAGES[getLocale()];
  bylineLink.href = pages.about;
  aboutLink.href = pages.about;
  privacyLink.href = pages.privacy;
  legalLink.href = pages.legal;

  renderLanguageSwitch();
}

function renderLanguageSwitch() {
  langSwitch.replaceChildren();
  for (const locale of LOCALES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = locale.toUpperCase();
    button.className = locale === getLocale() ? 'is-active' : '';
    button.setAttribute('aria-pressed', String(locale === getLocale()));
    button.addEventListener('click', () => {
      if (locale === getLocale()) return;
      setLocale(locale);
      applyLocale();
    });
    langSwitch.append(button);
  }
}

// --- wiring ---------------------------------------------------------------

for (const model of MODELS) {
  const option = document.createElement('option');
  option.value = model.id;
  option.textContent = t(model.labelKey);
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

applyLocale();
syncSliders(rotation.get());

// --- boot -----------------------------------------------------------------

void setModel(DEFAULT_MODEL_ID);
