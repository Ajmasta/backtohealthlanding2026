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
 *  Their videos and stills are in src/assets/exercises/<code>.mp4 and .webp. */
export const SHOWCASE = ['1.2', '2.4', '3.3', '4.2', '6.2', '7.1'];
