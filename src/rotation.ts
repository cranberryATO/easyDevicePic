import * as THREE from 'three';

export type RotationState = { x: number; y: number; z: number };

/** Slider ranges, in degrees. Pitch is limited so drag never inverts yaw. */
export const ROTATION_LIMITS: RotationState = { x: 90, y: 180, z: 180 };

export const DEFAULT_ROTATION: RotationState = { x: 0, y: 0, z: 0 };

const DEGREES_PER_PIXEL = 0.4;

export type RotationController = {
  get: () => RotationState;
  set: (partial: Partial<RotationState>) => void;
  reset: () => void;
};

/**
 * Single source of truth for the device's orientation. Mouse drag and the
 * sliders both write this state, so they can never drift apart — which is why
 * the app rotates the model rather than orbiting the camera.
 */
export function createRotationController(options: {
  target: THREE.Object3D;
  domElement: HTMLElement;
  onChange: (state: RotationState) => void;
}): RotationController {
  const { target, domElement, onChange } = options;
  const state: RotationState = { ...DEFAULT_ROTATION };

  function apply() {
    target.rotation.set(
      THREE.MathUtils.degToRad(state.x),
      THREE.MathUtils.degToRad(state.y),
      THREE.MathUtils.degToRad(state.z),
    );
    onChange({ ...state });
  }

  function set(partial: Partial<RotationState>) {
    if (partial.x !== undefined) {
      state.x = THREE.MathUtils.clamp(partial.x, -ROTATION_LIMITS.x, ROTATION_LIMITS.x);
    }
    if (partial.y !== undefined) state.y = wrap(partial.y, ROTATION_LIMITS.y);
    if (partial.z !== undefined) state.z = wrap(partial.z, ROTATION_LIMITS.z);
    apply();
  }

  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;

  domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || pointerId !== null) return;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    domElement.setPointerCapture(pointerId);
    domElement.classList.add('is-dragging');
  });

  domElement.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    set({
      y: state.y + dx * DEGREES_PER_PIXEL,
      x: state.x + dy * DEGREES_PER_PIXEL,
    });
  });

  function endDrag(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    domElement.releasePointerCapture(pointerId);
    domElement.classList.remove('is-dragging');
    pointerId = null;
  }

  domElement.addEventListener('pointerup', endDrag);
  domElement.addEventListener('pointercancel', endDrag);

  apply();

  return {
    get: () => ({ ...state }),
    set,
    reset: () => set(DEFAULT_ROTATION),
  };
}

/** Keeps an angle inside [-limit, limit] by wrapping around the full turn. */
function wrap(value: number, limit: number): number {
  const span = limit * 2;
  return ((((value + limit) % span) + span) % span) - limit;
}
