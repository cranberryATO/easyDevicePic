# Assets

Drop the supplied files here — nothing else needs to change.

```
public/models/phone.glb          default device
public/models/laptop.glb         second device (optional)
public/textures/placeholder.png  picture shown on first load
```

## Screen mesh convention

Each `.glb` must contain the screen surface as a **mesh or material named
`Screen`** (case-insensitive; `Screen.001`, `Screen_low` etc. also resolve).
Its material is replaced at load time with an unlit one carrying the picture,
so whatever material the export ships with is irrelevant.

If the name doesn't match, the app shows an error listing every mesh and
material name found in the file — either rename the surface in the GLB or
change `screenName` in [`src/models.ts`](../src/models.ts).

The screen's aspect ratio is derived from its bounding box. If a model's UV
island doesn't fill the geometry, set `screenAspect` for that entry in
`src/models.ts` instead.
