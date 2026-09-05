import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
// Extension included: Vite's native config loader requires it, and this file
// is outside tsconfig's `include`, so nothing rewrites the specifier.
import { FEATURES, PAGES, STRINGS } from './src/strings.ts';

const FR = STRINGS.fr;

const escapeText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeAttribute = (value: string) => escapeText(value).replace(/"/g, '&quot;');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function french(key: string): string {
  const value = FR[key];
  if (value === undefined) {
    throw new Error(`No French string for "${key}", which index.html asks for.`);
  }
  return value;
}

/** Rewrites the `content` of the single <meta> tag carrying `attr="key"`. */
function setMetaContent(html: string, attr: string, key: string, value: string): string {
  const tag = new RegExp(`<meta\\b[^>]*\\b${attr}="${escapeRegExp(key)}"[^>]*>`, 'g');
  let found = false;
  const out = html.replace(tag, (match) => {
    found = true;
    return match.replace(/\bcontent="[^"]*"/, `content="${escapeAttribute(value)}"`);
  });
  if (!found) throw new Error(`index.html has no <meta ${attr}="${key}">.`);
  return out;
}

/** Reads the `href` of the single <link> carrying `rel="key"`. */
function linkHref(html: string, rel: string): string {
  const match = new RegExp(`<link\\b[^>]*\\brel="${escapeRegExp(rel)}"[^>]*>`).exec(html);
  const href = match && /\bhref="([^"]*)"/.exec(match[0]);
  if (!href) throw new Error(`index.html has no <link rel="${rel}"> with an href.`);
  return href[1];
}

function setLinkHref(html: string, rel: string, value: string): string {
  const tag = new RegExp(`<link\\b[^>]*\\brel="${escapeRegExp(rel)}"[^>]*>`, 'g');
  return html.replace(tag, (match) =>
    match.replace(/\bhref="[^"]*"/, `href="${escapeAttribute(value)}"`),
  );
}

/** Repoints the <a id="..."> that applyLocale() would repoint at runtime. */
function setAnchorHref(html: string, id: string, value: string): string {
  const tag = new RegExp(`<a\\b[^>]*\\bid="${escapeRegExp(id)}"[^>]*>`, 'g');
  let found = false;
  const out = html.replace(tag, (match) => {
    found = true;
    return match.replace(/\bhref="[^"]*"/, `href="${escapeAttribute(value)}"`);
  });
  if (!found) throw new Error(`index.html has no <a id="${id}">.`);
  return out;
}

/**
 * Turns the built English home page into the French one.
 *
 * It walks the same two attributes as applyTranslations() in src/i18n.ts —
 * `data-i18n` for text, `data-i18n-attr` for attributes — so the runtime and
 * the build stay in step, and it throws on anything it cannot account for.
 * That is the whole safety story: index.html is the only source of structure
 * and src/strings.ts the only source of copy, and drift between them fails the
 * build rather than silently shipping a half-English page.
 */
export function toFrench(html: string): string {
  if (!/<html\s+lang="en"\s*>/.test(html)) {
    throw new Error('index.html no longer opens with <html lang="en">.');
  }
  // `data-locale` pins the locale in detectLocale(), so an English browser
  // cannot flip this page back to English after the JS boots.
  let out = html.replace(/<html\s+lang="en"\s*>/, '<html lang="fr" data-locale="fr">');

  // Every data-i18n element in index.html holds text and no child markup, which
  // is what lets a tag-matching regex stand in for a DOM walk here.
  const translated = new Set<string>();
  out = out.replace(
    /(<([a-zA-Z][\w-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2\s*>)/g,
    (_match, open: string, _tag: string, key: string, _text: string, close: string) => {
      translated.add(key);
      return `${open}${escapeText(french(key))}${close}`;
    },
  );

  out = out.replace(
    /<[a-zA-Z][\w-]*\b[^>]*\bdata-i18n-attr="([^"]+)"[^>]*>/g,
    (tag: string, spec: string) => {
      let rewritten = tag;
      for (const pair of spec.split(';')) {
        const [attribute, key] = pair.split(':').map((part) => part.trim());
        if (!attribute || !key) continue;
        translated.add(key);
        const existing = new RegExp(`\\b${escapeRegExp(attribute)}="[^"]*"`);
        const replacement = `${attribute}="${escapeAttribute(french(key))}"`;
        rewritten = existing.test(rewritten)
          ? rewritten.replace(existing, replacement)
          : rewritten.replace(/^(<[a-zA-Z][\w-]*)/, `$1 ${replacement}`);
      }
      return rewritten;
    },
  );

  if (translated.size === 0) {
    throw new Error('index.html carries no data-i18n attributes — nothing was translated.');
  }

  // The same four hrefs applyLocale() rewrites in main.ts. Without this a
  // crawler that does not run JS would follow /fr/ straight back into the
  // English pages.
  out = setAnchorHref(out, 'byline-link', PAGES.fr.about);
  out = setAnchorHref(out, 'link-about', PAGES.fr.about);
  out = setAnchorHref(out, 'link-privacy', PAGES.fr.privacy);
  out = setAnchorHref(out, 'link-legal', PAGES.fr.legal);

  // The head is not marked up with data-i18n: applyTranslations() sets the
  // title and description by hand, and the og:* tags stay English at runtime
  // because the scrapers that read them never run the JS. Here they can be
  // localized properly, since this page really is French before any JS runs.
  const title = new RegExp('<title>[\\s\\S]*?</title>');
  if (!title.test(out)) throw new Error('index.html has no <title>.');
  out = out.replace(title, `<title>${escapeText(french('meta.title'))}</title>`);

  out = setMetaContent(out, 'name', 'description', french('meta.description'));
  out = setMetaContent(out, 'property', 'og:title', french('meta.title'));
  out = setMetaContent(out, 'property', 'og:description', french('meta.description'));
  out = setMetaContent(out, 'property', 'og:image:alt', french('og.imageAlt'));
  out = setMetaContent(out, 'property', 'og:locale', 'fr');
  out = setMetaContent(out, 'property', 'og:locale:alternate', 'en');

  // Derived from the English page's own canonical rather than from
  // VITE_SITE_URL, so there is one place the origin can come from.
  const home = linkHref(out, 'canonical');
  const frenchHome = `${home.replace(/\/$/, '')}/fr/`;
  out = setLinkHref(out, 'canonical', frenchHome);
  out = setMetaContent(out, 'property', 'og:url', frenchHome);

  // The hreflang block is deliberately left alone: both pages advertise the
  // same set, which is what a self-referencing hreflang cluster requires.

  const jsonLd = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/;
  const found = jsonLd.exec(out);
  if (!found) throw new Error('index.html has no JSON-LD block.');
  const data = JSON.parse(found[2]) as Record<string, unknown>;
  if (JSON.stringify(data.featureList) !== JSON.stringify(FEATURES.en)) {
    throw new Error(
      "index.html's JSON-LD featureList no longer matches FEATURES.en in src/strings.ts — " +
        'update both so the French list stays a translation of the English one.',
    );
  }
  data.url = frenchHome;
  data.description = french('meta.description');
  data.inLanguage = 'fr';
  data.featureList = FEATURES.fr;
  if (data.author && typeof data.author === 'object') {
    (data.author as Record<string, unknown>).jobTitle = french('app.byline.role');
  }
  out = out.replace(jsonLd, `$1\n${JSON.stringify(data, null, 2)}\n$3`);

  // index.html's comments describe the English page — that its title is swapped
  // at runtime, that its og:* tags stay English. None of that is true here, so
  // rather than ship contradictions, drop them for one honest header.
  out = out
    .replace(/[ \t]*<!--[\s\S]*?-->\n?/g, '')
    .replace(
      /^<!doctype html>/i,
      '<!doctype html>\n<!-- Generated from index.html at build time by vite.config.ts. Do not edit. -->',
    );

  return out;
}

/**
 * `/fr/` is the French home page. It is generated from the *built* index.html
 * rather than registered as a second Rollup input, so there is no duplicated
 * markup to keep in sync and no generated file in the working tree. Built asset
 * URLs are absolute (`/assets/main-*.js`), so the copy resolves them unchanged.
 */
function frenchHomePage(): Plugin {
  return {
    name: 'easydevicepic:french-home-page',
    enforce: 'post',

    // Served in dev through the same transform, so `npm run dev` and the built
    // site cannot disagree about what /fr/ looks like.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (url !== '/fr/' && url !== '/fr/index.html') return next();

        const source = path.resolve(server.config.root, 'index.html');
        readFile(source, 'utf8')
          .then((raw) => server.transformIndexHtml('/', raw, req.originalUrl))
          .then((html) => {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(toFrench(html));
          })
          .catch(next);
      });
    },

    async writeBundle(options, bundle) {
      const built = bundle['index.html'];
      if (!built || built.type !== 'asset') {
        throw new Error('index.html is missing from the bundle — cannot build /fr/.');
      }

      const directory = path.resolve(options.dir ?? 'dist', 'fr');
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, 'index.html'), toFrench(String(built.source)), 'utf8');
    },
  };
}

export default defineConfig({
  plugins: [frenchHomePage()],
  build: {
    rollupOptions: {
      // Every HTML entry point has to be listed, or only index.html is built.
      // /fr/index.html is absent on purpose: it is generated from this one.
      input: {
        main: 'index.html',
        about: 'about.html',
        aPropos: 'a-propos.html',
        privacy: 'privacy.html',
        confidentialite: 'confidentialite.html',
        legal: 'legal.html',
        mentionsLegales: 'mentions-legales.html',
      },
    },
  },
});
