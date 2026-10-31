# BackToHealth website

The landing page: plain HTML, CSS and JS, with no framework. Decisions: Block 15 in `docs/vision-and-decisions.md`.

```bash
node build.mjs
```

This writes `docs/`, which GitHub Pages serves: French at `/`, English at `/en/`. Commit `docs/` with your change, since Pages does not run the build. The build needs the full project folder around `website/`. To preview, use `website` in `.claude/launch.json` (port 8095).

- `src/template.html`: the page. `{{a.b}}` is a translation key.
- `i18n/fr.json`, `i18n/en.json`: all the text. A missing key stops the build.
- `src/styles.css`, `src/main.js`: look and motion. The page is complete without JS.
- `make-images.mjs`: draws the share images and icons into `src/share/`, with headless Edge. Rerun it only if the logo or the tagline changes.
- `build.mjs`: the contact address and site address are at the top. It takes the landscape and fonts from `mobile/`, and the logo and screens from `design/`, so keep them in those places.

Before publishing: Pierre-Henri validates the text, the contact address is confirmed, and the screens become real app screenshots.
