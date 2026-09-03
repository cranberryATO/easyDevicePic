# easyDevicePic

Display a picture on a device screen. Download render.

A one-page app that maps an image onto a 3D device model, lets you rotate the
device with the mouse or with explicit angle sliders, and exports the render as
a PNG with a transparent background.

## Getting started

```bash
npm install
npm run dev
```

Then add the assets — the app needs them to show anything:

```
public/models/phone.glb                  default device
public/models/laptop.glb                 second device (optional)
public/textures/phone-placeholder.png    picture shown on the phone
public/textures/laptop-placeholder.png   picture shown on the laptop
```

Each device carries its own placeholder (`placeholderImageUrl` in
`src/models.ts`) because screen aspect ratios differ so much between them.

See [`public/README.md`](public/README.md) for the screen-mesh naming
convention each `.glb` must follow.

| Script | |
| --- | --- |
| `npm run dev` | dev server with hot reload |
| `npm run build` | typecheck, then build to `dist/` |
| `npm run preview` | serve the production build |
| `npm run typecheck` | types only |

## Using it

- **Change the picture** — drag & drop an image anywhere on the page, or use
  *Choose image…*. The screen texture updates immediately.
- **Fit** — *Stretch* (default) fills the screen regardless of aspect ratio;
  *Cover* crops to fill; *Contain* fits the whole picture with black bars.
- **Rotate** — drag the model, or set the X/Y/Z angles with the sliders. Both
  write the same state, so they always agree. Scroll to zoom.
- **Download PNG** — exports at a fixed **2000px** width, with the height
  following the window's aspect ratio, on a transparent background. The export
  frames exactly what is on screen.

## How it works

`src/` is small and each file does one thing:

| File | |
| --- | --- |
| `scene.ts` | renderer, camera, lighting, render-on-demand loop |
| `device.ts` | GLTF loading, screen-mesh lookup, material swap |
| `screenTexture.ts` | image → canvas → texture, with the three fit modes |
| `rotation.ts` | the single rotation state that drag and sliders share |
| `exportPng.ts` | fixed-resolution transparent PNG render |
| `models.ts` | the device registry |
| `ui.ts` / `main.ts` | DOM helpers and wiring |

A few decisions worth knowing about if you change things:

- **Rotation moves the model, not the camera.** Orbiting the camera cannot be
  reconciled with angle sliders — they would drift apart after every drag — so
  `rotation.ts` owns one euler state that both inputs write.
- **The screen material is unlit** (`MeshBasicMaterial`, `toneMapped: false`)
  so the picture's colours come through exactly, untinted by the light rig.
- **`texture.flipY = false`** is required: glTF UVs assume unflipped textures,
  unlike Three's default. Without it the picture renders upside down.
- **Transparency** comes from an `alpha: true` renderer with a zero clear
  alpha and no scene background. Lighting is a `RoomEnvironment` PMREM map, so
  the device gets real reflections without anything being drawn behind it.
- **Export** resizes the canvas in place with `updateStyle: false` and reads it
  back with `toBlob`, which lets the browser un-premultiply the alpha — that is
  what keeps the device edges free of a dark fringe.
