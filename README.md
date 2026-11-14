# BackToHealth website

The landing site: plain HTML, CSS and JS, no framework and no dependencies (Node 20+ only). French at `/`, English at `/en/`.

```bash
npm run dev      # build, then preview at http://localhost:8095 (same as ./start.sh)
npm run build    # write docs/
```

GitHub Pages serves `docs/` and does not run the build, so commit `docs/` with every change.

## Layout

```
site.config.mjs         contact address, site address, languages, pages
content/
  i18n/fr.json, en.json all the page text; both files must have the same keys
  app/fr.json, en.json  exercise and lesson names, copied from the app (do not edit by hand)
src/
  pages/                one template per page: {{a.b}} a text key, {{> head}} a partial,
                        {{#each faq.items}}…{{.q}}…{{@n}}…{{/each}} a list from the text
  partials/head.html    the <head> shared by every page (SEO, social cards, hreflang)
  assets/               copied to docs/assets/ as is (svg/ is inlined into the pages instead);
                        images in WebP, fonts in WOFF2
scripts/
  build.mjs             renders every page in every language, plus robots.txt and sitemap.xml
  serve.mjs             local preview of docs/
  sync-from-app.mjs     refreshes content/app/, the tree drawings, landscape and fonts from the app repo
  make-images.mjs       draws the share images and icons with headless Chrome or Edge
```

## Common tasks

- **Change a text**: edit `content/i18n/fr.json` and `en.json`, then build. A missing key, or a key in one language and not the other, stops the build.
- **Add a FAQ question, a card or a team member**: add an item to the list (`faq.items`, `pros.cards`, `team.people`…) in both language files. No template change.
- **Add a page**: add a template in `src/pages/`, a line in `PAGES` in `site.config.mjs`, and its `title` and `description` in both language files.
- **The app's exercises or lessons changed**: `npm run sync -- /path/to/monorepo` (the folder holding `mobile/` and `design/`), then build. It needs `cwebp` (`brew install webp`) and `pip install fonttools brotli`.
- **The logo or tagline changed**: sync, then `npm run images`.
- **The 3D exercises shown**: `SHOWCASE` in `site.config.mjs`, then `npm run exercises -- /path/to/livraison-exercices-3d` (needs ffmpeg and cwebp). Family 4 is left out: its 3D clips are still copies of family 1.
- **The movement test pictures and video**: `npm run evaluation -- /path/to/app/assets/movement/flexion` redraws the app's photos as flat illustrations in the brand's colours (needs ffmpeg, cwebp, and Python with numpy and Pillow; about 7 minutes).
- **The app's words** (the test, the pain scale): the `app` section of the language files repeats `src/i18n/fr.json` of the app. Keep them identical.

Before publishing: Pierre-Henri validates the text, the contact address is confirmed, and the screens become real app screenshots.
