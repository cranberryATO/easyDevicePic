export type Locale = 'en' | 'fr';

export const LOCALES: Locale[] = ['en', 'fr'];

const STORAGE_KEY = 'easydevicepic.lang';

/**
 * English is the fallback: a key missing from the French table renders its
 * English text rather than a raw key.
 */
const STRINGS: Record<Locale, Record<string, string>> = {
  en: {
    'meta.title': 'easyDevicePic — put your screenshot on a 3D phone or laptop',
    'meta.description':
      'Drop a screenshot onto a 3D phone or laptop, rotate it to any angle, and download the render as a PNG with a transparent background. Runs entirely in your browser — nothing is uploaded.',

    'app.byline.prefix': 'by',
    'app.byline.role': 'Conseil et développement logiciel',
    'app.intro':
      'easyDevicePic maps your screenshot onto a 3D phone or laptop model, lets you rotate the device to any angle with the mouse or with precise X/Y/Z sliders, and exports the result as a 2000 px-wide PNG with a fully transparent background — ready to drop into a landing page, a slide deck or an app-store listing. Everything runs in your browser: your images are never uploaded to a server.',

    'drop.overlay': 'Drop an image to map it onto the screen',
    'drop.notAnImage': '“{name}” is not an image — drop a PNG, JPG, WebP or GIF.',

    'field.device': 'Device',
    'field.picture': 'Picture',
    'field.fit': 'Fit',
    'field.rotation': 'Rotation',

    'model.phone': 'Phone',
    'model.laptop': 'Laptop',

    'picture.choose': 'Choose image…',
    'picture.hint.drag': '…or drag & drop one anywhere on the page.',
    'picture.hint.tap': 'Pick a photo from your library or take one.',

    'fit.legend': 'Fit mode',
    'fit.stretch': 'Stretch',
    'fit.cover': 'Cover',
    'fit.contain': 'Contain',

    'rotation.reset': 'Reset rotation',

    'export.download': 'Download PNG',
    'export.size': 'Transparent PNG, cropped to the device, 1080 px on its longer side.',
    'export.failed': 'The browser could not encode the render as a PNG.',
    'export.empty': 'Nothing to export — the device is not visible in the frame.',
    'export.privacy': 'Runs entirely in your browser. Your images are never uploaded.',

    'nav.about': 'About',
    'nav.privacy': 'Privacy',
    'nav.legal': 'Mentions légales',
    'nav.language': 'Language',
  },

  fr: {
    'meta.title': 'easyDevicePic — votre capture d’écran sur un mobile ou un portable en 3D',
    'meta.description':
      'Déposez une capture d’écran sur un mobile ou un ordinateur portable en 3D, orientez-le comme vous voulez, et téléchargez le rendu en PNG sur fond transparent. Tout se passe dans votre navigateur — rien n’est envoyé.',

    'app.byline.prefix': 'par',
    'app.byline.role': 'Conseil et développement logiciel',
    'app.intro':
      'easyDevicePic applique votre capture d’écran sur un modèle 3D de mobile ou d’ordinateur portable, vous laisse l’orienter à la souris ou au degré près avec les curseurs X/Y/Z, et exporte le résultat en PNG de 2000 px de large sur fond entièrement transparent — prêt à intégrer dans une page, une présentation ou une fiche d’application. Tout se passe dans votre navigateur : vos images ne sont jamais envoyées sur un serveur.',

    'drop.overlay': 'Déposez une image pour l’afficher sur l’écran',
    'drop.notAnImage': '« {name} » n’est pas une image — déposez un PNG, JPG, WebP ou GIF.',

    'field.device': 'Appareil',
    'field.picture': 'Image',
    'field.fit': 'Cadrage',
    'field.rotation': 'Rotation',

    'model.phone': 'Téléphone',
    'model.laptop': 'Ordinateur portable',

    'picture.choose': 'Choisir une image…',
    'picture.hint.drag': '…ou glissez-déposez-en une n’importe où sur la page.',
    'picture.hint.tap': 'Choisissez une photo dans votre galerie ou prenez-en une.',

    'fit.legend': 'Mode de cadrage',
    'fit.stretch': 'Étirer',
    'fit.cover': 'Remplir',
    'fit.contain': 'Contenir',

    'rotation.reset': 'Réinitialiser la rotation',

    'export.download': 'Télécharger le PNG',
    'export.size': 'PNG transparent, rogné sur l’appareil, 1080 px sur son grand côté.',
    'export.failed': 'Le navigateur n’a pas pu encoder le rendu en PNG.',
    'export.empty': 'Rien à exporter — l’appareil n’est pas visible dans le cadre.',
    'export.privacy':
      'Tout se passe dans votre navigateur. Vos images ne sont jamais envoyées.',

    'nav.about': 'À propos',
    'nav.privacy': 'Confidentialité',
    'nav.legal': 'Mentions légales',
    'nav.language': 'Langue',
  },
};

/** Where each footer link points, per locale. */
export const PAGES: Record<Locale, { about: string; privacy: string; legal: string }> = {
  en: { about: '/about.html', privacy: '/privacy.html', legal: '/mentions-legales.html' },
  fr: { about: '/a-propos.html', privacy: '/confidentialite.html', legal: '/mentions-legales.html' },
};

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'fr';
}

/**
 * `?lang=` wins (shareable and testable), then a stored choice, then the
 * browser's own preference, then English.
 */
export function detectLocale(): Locale {
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (isLocale(requested)) return requested;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Private mode or blocked storage — fall through to the browser language.
  }

  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    if (tag?.toLowerCase().startsWith('fr')) return 'fr';
    if (tag?.toLowerCase().startsWith('en')) return 'en';
  }
  return 'en';
}

let current: Locale = detectLocale();

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale) {
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not being able to remember the choice is not worth failing over.
  }
}

export function t(key: string, vars: Record<string, string | number> = {}): string {
  const template = STRINGS[current][key] ?? STRINGS.en[key];
  if (template === undefined) {
    console.warn(`i18n: missing key "${key}"`);
    return key;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Fills every `data-i18n` node's text, plus `data-i18n-attr` attribute pairs
 * written as `"aria-label:fit.legend"` (semicolon-separated for several).
 */
export function applyTranslations(root: ParentNode = document) {
  for (const node of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = node.dataset.i18n;
    if (key) node.textContent = t(key);
  }

  for (const node of root.querySelectorAll<HTMLElement>('[data-i18n-attr]')) {
    for (const pair of node.dataset.i18nAttr?.split(';') ?? []) {
      const [attribute, key] = pair.split(':').map((part) => part.trim());
      if (attribute && key) node.setAttribute(attribute, t(key));
    }
  }

  document.documentElement.lang = current;
  document.title = t('meta.title');
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', t('meta.description'));
}
