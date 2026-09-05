export type ModelConfig = {
  id: string;
  /** i18n key for the name shown in the device dropdown. */
  labelKey: string;
  /**
   * Path under public/, as a root-absolute URL. The leading slash matters:
   * these are fetched from whatever page is open, and the French home page
   * lives at /fr/, so a relative path would look for /fr/models/… instead.
   */
  url: string;
  /**
   * Name of the mesh — or of its material — that carries the screen surface.
   * Matched case-insensitively. If nothing matches, the loader reports every
   * mesh and material name it found so the GLB can be corrected.
   */
  screenName: string;
  /**
   * Picture shown until the user supplies one. Per-model, because a phone and
   * a laptop screen have very different aspect ratios.
   */
  placeholderImageUrl: string;
  /**
   * Width / height of the screen image area. Normally derived from the screen
   * mesh's bounding box; set this when the model's UVs don't match its
   * geometry (e.g. a screen mesh with padding baked into the UV island).
   */
  screenAspect?: number;
};

export const MODELS: ModelConfig[] = [
  {
    id: "phone",
    labelKey: "model.phone",
    url: "/models/phone.glb",
    screenName: "Screen",
    placeholderImageUrl: "/textures/9_20_placeholder.png",
  },
  {
    id: "laptop",
    labelKey: "model.laptop",
    url: "/models/laptop.glb",
    screenName: "Screen",
    placeholderImageUrl: "/textures/fhd_placeholder.png",
  },
];

export const DEFAULT_MODEL_ID = "phone";

export function getModel(id: string): ModelConfig {
  const model = MODELS.find((m) => m.id === id);
  if (!model) throw new Error(`Unknown model id: ${id}`);
  return model;
}
