import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const FOV = 30;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;

export type Viewer = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  /** Object the device is parented to; rotating this rotates the device. */
  pivot: THREE.Group;
  /** Schedule a frame. Rendering is on demand — there is no animation loop. */
  requestRender: () => void;
  /** Render immediately, bypassing the rAF queue (used by the PNG export). */
  renderNow: () => void;
  /** Pull the camera back far enough to frame a sphere of this radius. */
  frameRadius: (radius: number) => void;
  resize: () => void;
};

export function createViewer(
  canvas: HTMLCanvasElement,
  options: { onResize?: () => void } = {},
): Viewer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    // Lets the export read the canvas back with toBlob after rendering.
    preserveDrawingBuffer: true,
  });
  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  // Left null so the PNG background stays transparent.
  scene.background = null;

  // Image-based lighting gives the device believable reflections without
  // drawing anything into the frame.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 3, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-3, 1, -2);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 1000);
  camera.position.set(0, 0, 5);

  const pivot = new THREE.Group();
  pivot.rotation.order = 'YXZ';
  scene.add(pivot);

  let baseDistance = 5;
  let zoom = 1;
  let frameHandle = 0;

  function renderNow() {
    if (frameHandle) {
      cancelAnimationFrame(frameHandle);
      frameHandle = 0;
    }
    renderer.render(scene, camera);
  }

  function requestRender() {
    if (frameHandle) return;
    frameHandle = requestAnimationFrame(() => {
      frameHandle = 0;
      renderer.render(scene, camera);
    });
  }

  function applyZoom() {
    camera.position.set(0, 0, baseDistance * zoom);
    camera.lookAt(0, 0, 0);
    camera.near = Math.max(0.01, baseDistance * zoom * 0.01);
    camera.far = baseDistance * zoom * 100;
    camera.updateProjectionMatrix();
  }

  function frameRadius(radius: number) {
    // 1.35 leaves a margin so the device never touches the frame edge.
    baseDistance = (radius / Math.sin((FOV * Math.PI) / 360)) * 1.35;
    applyZoom();
    requestRender();
  }

  function resize() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    options.onResize?.();
    requestRender();
  }

  // Observe the canvas rather than the window: on narrow screens the canvas is
  // half the viewport, so it also changes when the panel reflows or the mobile
  // URL bar collapses — neither of which fires a window resize event.
  // setSize(…, false) leaves the CSS size alone, so this can't feed back.
  new ResizeObserver(resize).observe(canvas);
  resize();

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      zoom = THREE.MathUtils.clamp(zoom * Math.exp(event.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM);
      applyZoom();
      requestRender();
    },
    { passive: false },
  );

  return { renderer, scene, camera, canvas, pivot, requestRender, renderNow, frameRadius, resize };
}
