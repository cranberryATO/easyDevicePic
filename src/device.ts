import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ModelConfig } from './models';

export type Device = {
  /** Model root, recentred on the origin so rotation spins about its middle. */
  root: THREE.Group;
  screen: THREE.Mesh;
  screenMaterial: THREE.MeshBasicMaterial;
  /** Width / height of the screen's image area. */
  screenAspect: number;
  /** Bounding-sphere radius, used to frame the camera. */
  radius: number;
};

const loader = new GLTFLoader();

export async function loadDevice(config: ModelConfig): Promise<Device> {
  const gltf = await loader.loadAsync(config.url);
  const model = gltf.scene;

  const screen = findScreenMesh(model, config.screenName);
  const screenAspect = config.screenAspect ?? computeScreenAspect(screen);

  // An unlit material reproduces the picture's colors exactly; a lit one would
  // tint and darken it with whatever the light rig happens to be doing.
  const screenMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    toneMapped: false,
  });
  screen.material = screenMaterial;

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
  model.position.sub(center);

  const root = new THREE.Group();
  root.add(model);

  return { root, screen, screenMaterial, screenAspect, radius };
}

export function disposeDevice(device: Device) {
  device.screenMaterial.map?.dispose();
  device.screenMaterial.dispose();
  device.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of toMaterialArray(object.material)) {
      if (material !== device.screenMaterial) material.dispose();
    }
  });
}

function toMaterialArray(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}

/**
 * Locates the screen by the `Screen` naming convention, on the mesh or on its
 * material. Exact matches win, then prefixes, then substrings — so exports that
 * append a suffix (`Screen.001`, `Screen_low`) still resolve.
 */
function findScreenMesh(model: THREE.Object3D, screenName: string): THREE.Mesh {
  const needle = screenName.toLowerCase();
  const meshes: THREE.Mesh[] = [];
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });

  const namesOf = (mesh: THREE.Mesh) => [
    mesh.name,
    ...toMaterialArray(mesh.material).map((material) => material.name),
  ];

  const tests: Array<(name: string) => boolean> = [
    (name) => name === needle,
    (name) => name.startsWith(needle),
    (name) => name.includes(needle),
  ];

  for (const test of tests) {
    const match = meshes.find((mesh) =>
      namesOf(mesh).some((name) => test(name.toLowerCase())),
    );
    if (match) return match;
  }

  const inventory = meshes
    .map((mesh) => {
      const materials = toMaterialArray(mesh.material)
        .map((material) => material.name || '(unnamed)')
        .join(', ');
      return `  mesh "${mesh.name || '(unnamed)'}" — material(s): ${materials}`;
    })
    .join('\n');

  throw new Error(
    `No mesh or material named "${screenName}" in this model.\n` +
      `Rename the screen surface in the GLB, or change screenName in src/models.ts.\n` +
      `Found:\n${inventory || '  (no meshes at all)'}`,
  );
}

/**
 * Derives the screen's width / height from its bounding box. The smallest
 * extent is the surface normal; of the remaining two, X is taken as horizontal
 * and Y as vertical, falling back to Z when the screen faces another axis.
 */
function computeScreenAspect(screen: THREE.Mesh): number {
  const size = new THREE.Box3().setFromObject(screen).getSize(new THREE.Vector3());
  const extents = [
    ['x', size.x],
    ['y', size.y],
    ['z', size.z],
  ] as const;

  const planar = [...extents].sort((a, b) => a[1] - b[1]).slice(1);
  const axes = planar.map(([axis]) => axis);
  const horizontal = axes.includes('x') ? 'x' : 'z';
  const vertical = axes.includes('y') ? 'y' : 'z';

  const width = size[horizontal];
  const height = size[vertical];
  if (!(width > 0) || !(height > 0)) {
    console.warn('Screen mesh has a degenerate bounding box; assuming a square screen.');
    return 1;
  }
  return width / height;
}
