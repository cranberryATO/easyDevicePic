import { STRINGS, isLocale, type Locale } from './strings';

export { LOCALES, PAGES } from './strings';
export type { Locale } from './strings';

const STORAGE_KEY = 'easydevicepic.lang';

/**
 * `data-locale` on <html>, stamped into pages that are generated per locale
 * (/fr/), wins over everything else: their text is already baked in, so
 * re-detecting would flip a French URL to English for an English browser.
 * Then `?lang=` (shareable and testable), then a stored choice, then the
 * browser's own preference, then English.
 */
export function detectLocale(): Locale {
  const pinned = document.documentElement.dataset.locale;
  if (isLocale(pinned)) return pinned;

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
 *
 * The build-time renderer in vite.config.ts walks the same two attributes, so
 * a change here needs mirroring there.
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
