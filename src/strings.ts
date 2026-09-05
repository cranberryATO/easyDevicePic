/**
 * Every translatable string and per-locale URL, kept free of any DOM or browser
 * API on purpose: the Vite config imports this module in Node to bake the
 * French home page at /fr/ out of the built index.html. Anything that touches
 * `window` belongs in i18n.ts, which re-exports what the app needs from here.
 */

export type Locale = "en" | "fr";

export const LOCALES: Locale[] = ["en", "fr"];

/**
 * English is the fallback: a key missing from the French table renders its
 * English text rather than a raw key.
 */
export const STRINGS: Record<Locale, Record<string, string>> = {
  en: {
    "meta.title": "easyDevicePic — put your screenshot on a 3D phone or laptop",
    "meta.description":
      "Drop a screenshot onto a 3D phone or laptop, rotate it to any angle, and download the render as a PNG with a transparent background. Runs entirely in your browser — nothing is uploaded.",

    "app.byline.prefix": "by:",
    "app.byline.role": "André Tousch — Software consultant and developer",
    "app.intro":
      "easyDevicePic maps your screenshot onto a 3D phone or laptop model, lets you rotate the device to any angle with the mouse or with precise X/Y/Z sliders, and exports the result as a 2000 px-wide PNG with a fully transparent background — ready to drop into a landing page, a slide deck or an app-store listing. Everything runs in your browser: your images are never uploaded to a server.",

    "drop.overlay": "Drop an image to map it onto the screen",
    "drop.notAnImage":
      "“{name}” is not an image — drop a PNG, JPG, WebP or GIF.",

    "field.device": "Device",
    "field.picture": "Picture",
    "field.fit": "Fit",
    "field.rotation": "Rotation",

    "model.phone": "Phone",
    "model.laptop": "Laptop",

    "picture.choose": "Choose image…",
    "picture.hint.drag": "…or drag & drop one anywhere on the page.",
    "picture.hint.tap": "Pick a photo from your library or take one.",

    "fit.legend": "Fit mode",
    "fit.stretch": "Stretch",
    "fit.cover": "Cover",
    "fit.contain": "Contain",

    "rotation.reset": "Reset rotation",

    "export.download": "Download PNG",
    "export.size":
      "Transparent PNG, cropped to the device, 1080 px on its longer side.",
    "export.failed": "The browser could not encode the render as a PNG.",
    "export.empty":
      "Nothing to export — the device is not visible in the frame.",
    "export.privacy":
      "Runs entirely in your browser. Your images are never uploaded.",

    "og.imageAlt":
      "A 3D phone showing a screenshot, next to the easyDevicePic logo.",

    "nav.about": "About",
    "nav.privacy": "Privacy",
    "nav.legal": "Legal",
    "nav.language": "Language",
  },

  fr: {
    // “mockup” and “maquette” are what French designers and developers actually
    // search for; the no-account/no-cookie angle is the differentiator that
    // matters most to a French audience, so both lead the snippet.
    "meta.title":
      "easyDevicePic — mockup d’appareil 3D à partir de votre capture d’écran",
    "meta.description":
      "Maquette (mockup) d’appareil en 3D : déposez une capture d’écran sur un mobile ou un portable, orientez-le, téléchargez un PNG transparent. Sans compte ni cookie.",

    // Narrow no-break space before the colon, as French typography requires.
    "app.byline.prefix": "par :",
    "app.byline.role": "André Tousch — Conseil et développement logiciel",
    "app.intro":
      "easyDevicePic applique votre capture d’écran sur un modèle 3D de mobile ou d’ordinateur portable, vous laisse l’orienter à la souris ou au degré près avec les curseurs X/Y/Z, et exporte le résultat en PNG de 2000 px de large sur fond entièrement transparent — prêt à intégrer dans une page, une présentation ou une fiche d’application. Tout se passe dans votre navigateur : vos images ne sont jamais envoyées sur un serveur.",

    "drop.overlay": "Déposez une image pour l’afficher sur l’écran",
    "drop.notAnImage":
      "« {name} » n’est pas une image — déposez un PNG, JPG, WebP ou GIF.",

    "field.device": "Appareil",
    "field.picture": "Image",
    "field.fit": "Cadrage",
    "field.rotation": "Rotation",

    "model.phone": "Téléphone",
    "model.laptop": "Ordinateur portable",

    "picture.choose": "Choisir une image…",
    "picture.hint.drag": "…ou glissez-déposez-en une n’importe où sur la page.",
    "picture.hint.tap":
      "Choisissez une photo dans votre galerie ou prenez-en une.",

    "fit.legend": "Mode de cadrage",
    "fit.stretch": "Étirer",
    "fit.cover": "Remplir",
    "fit.contain": "Contenir",

    "rotation.reset": "Réinitialiser la rotation",

    "export.download": "Télécharger le PNG",
    "export.size":
      "PNG transparent, rogné sur l’appareil, 1080 px sur son grand côté.",
    "export.failed": "Le navigateur n’a pas pu encoder le rendu en PNG.",
    "export.empty":
      "Rien à exporter — l’appareil n’est pas visible dans le cadre.",
    "export.privacy":
      "Tout se passe dans votre navigateur. Vos images ne sont jamais envoyées.",

    "og.imageAlt":
      "Un téléphone en 3D affichant une capture d’écran, à côté du logo easyDevicePic.",

    "nav.about": "À propos",
    "nav.privacy": "Confidentialité",
    "nav.legal": "Mentions légales",
    "nav.language": "Langue",
  },
};

/**
 * The `featureList` of the WebApplication JSON-LD in index.html. Kept here so
 * the generated French page can carry a French list; the build asserts that
 * `en` still matches what index.html actually contains, so the two cannot
 * drift apart silently.
 */
export const FEATURES: Record<Locale, string[]> = {
  en: [
    "Map a screenshot onto a 3D phone or laptop model",
    "Rotate the device by dragging or with exact X/Y/Z sliders",
    "Stretch, cover or contain the picture on the screen",
    "Export a PNG with a fully transparent background",
    "Runs client-side — images are never uploaded",
  ],
  fr: [
    "Applique une capture d’écran sur un modèle 3D de téléphone ou d’ordinateur portable",
    "Oriente l’appareil à la souris ou au degré près avec des curseurs X/Y/Z",
    "Cadre l’image en mode étiré, rempli ou contenu",
    "Exporte un PNG sur fond entièrement transparent",
    "Tout se passe dans le navigateur — aucune image n’est envoyée",
  ],
};

/**
 * Where each locale's pages live. `app` is the home page: English is served at
 * the root and localized at runtime, French is a real document generated at
 * build time — see the frenchHomePage plugin in vite.config.ts.
 */
export const PAGES: Record<
  Locale,
  { app: string; about: string; privacy: string; legal: string }
> = {
  en: {
    app: "/",
    about: "/about.html",
    privacy: "/privacy.html",
    legal: "/legal.html",
  },
  fr: {
    app: "/fr/",
    about: "/a-propos.html",
    privacy: "/confidentialite.html",
    legal: "/mentions-legales.html",
  },
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "fr";
}
