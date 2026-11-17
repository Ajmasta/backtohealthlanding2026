// Everything about the site that is not text or design: addresses, languages and pages.

/** Address used by every "notify me" and "write to the team" link. */
export const CONTACT = 'adrien@backtohealth.app';

/** Public address of the site, with a trailing slash. */
export const SITE = 'https://ajmasta.github.io/backtohealthlanding2026/';

/** The first language is the default one, served at the root; the others get their own folder. */
export const LANGS = [
  { code: 'fr', dir: '' },
  { code: 'en', dir: 'en/' },
];

/** Each page: its template in src/pages/, the folder it is written to, and where its title and description live in the text. */
export const PAGES = [
  { id: 'home', template: 'home.html', dir: '', meta: 'meta', ogType: 'website' },
  { id: 'program', template: 'program.html', dir: 'programme/', meta: 'program.meta', ogType: 'article' },
];

/** The exercises shown in 3D on the home page, one per family, as app codes (family.level).
 *  `shot` says how the 3D render is framed: the figure lies on the floor, or stands.
 *  Their videos and stills are made by scripts/make-exercise-media.mjs.
 *  Not family 4: its 3D clips are still copies of family 1, from before it became trunk stabilisation. */
export const SHOWCASE = [
  { code: '1.2', shot: 'floor' },
  { code: '2.4', shot: 'floor' },
  { code: '3.3', shot: 'floor' },
  { code: '6.2', shot: 'standing' },
  { code: '7.1', shot: 'standing' },
  { code: '8.1', shot: 'floor' },
];
