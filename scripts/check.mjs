// Checks the built site in a real browser: layout, navigation, scrolling and the interactive assessment,
// on every page, in both languages, at several window sizes. No dependency: it drives a headless Chrome
// through its debugging port.
// Run: npm test   (about ten minutes for the six window sizes; one size only: npm test -- 1280x720;
// CHROME=/path/to/chrome if it is not found)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8197, DEBUG = 9337, BASE = `http://localhost:${PORT}/`;
const chrome = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && existsSync(p));
if (!chrome) throw new Error('No Chrome or Edge found. Set CHROME to its path.');

const SIZES = [[1280, 720], [1440, 900], [1000, 915], [1920, 1080], [1200, 1400], [768, 1024], [375, 812]];
const HOMES = ['', 'en/'], PROGRAMS = ['programme/', 'en/programme/'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- A very small client for the browser's debugging protocol
let socket, nextId = 0;
const waiting = new Map(), problems = new Map();
function send(method, params = {}, sessionId) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((resolve, reject) => waiting.set(id, { resolve, reject, method }));
}
function onMessage(event) {
  const m = JSON.parse(event.data);
  if (m.id) {
    const w = waiting.get(m.id); waiting.delete(m.id);
    if (m.error) w.reject(new Error(`${w.method}: ${m.error.message}`)); else w.resolve(m.result);
  } else if (m.method === 'Runtime.exceptionThrown') {
    problems.get(m.sessionId)?.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    problems.get(m.sessionId)?.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  } else if (m.method === 'Network.loadingFailed' && !m.params.canceled) {
    problems.get(m.sessionId)?.push(`request failed: ${m.params.errorText}`);
  }
}

async function openPage(path, [width, height]) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Target.activateTarget', { targetId });
  problems.set(sessionId, []);
  const mobile = width < 768;
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile }, sessionId);
  await Promise.all(['Page.enable', 'Runtime.enable', 'Network.enable'].map((m) => send(m, {}, sessionId)));
  await send('Page.navigate', { url: BASE + path }, sessionId);
  const page = {
    sessionId, width, height,
    async run(fn, ...args) {
      const r = await send('Runtime.evaluate', { expression: `(${fn})(...${JSON.stringify(args)})`, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    // A real click, where the element is on screen.
    async click(selector) {
      const p = await page.run((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, selector);
      for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 }, sessionId);
    },
    // A real scroll gesture, like a trackpad flick: many events, fading out.
    async flick(sign) {
      const sent = [];
      for (let i = 0; i < 45; i++) {
        sent.push(send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: width / 2, y: height / 2, deltaX: 0, deltaY: sign * Math.max(1, 40 * Math.exp(-i / 12)) }, sessionId));
        await sleep(16);
      }
      await Promise.all(sent);
    },
    async key(key, code = key) {
      for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key, code }, sessionId);
    },
    // Waits until the page has stopped scrolling.
    async settle() {
      let last = -1, still = 0;
      for (let i = 0; i < 80 && still < 5; i++) { await sleep(80); const y = await page.run(() => Math.round(scrollY)); if (y === last) still++; else { still = 0; last = y; } }
      await sleep(120);
      return last;
    },
    errors: () => problems.get(sessionId),
    close: () => send('Target.closeTarget', { targetId }),
  };
  for (let i = 0; i < 100; i++) { if (await page.run(() => document.readyState === 'complete').catch(() => false)) break; await sleep(100); }
  await sleep(300);
  return page;
}

// --- What the page itself can tell
const inPage = {
  // Where each section is expected to land, as the site's script computes it.
  stops: () => [...document.querySelectorAll('.hero, .band, .night')].map((el) => {
    const r = el.getBoundingClientRect();
    const at = el.classList.contains('night') ? r.bottom + scrollY - innerHeight : el.classList.contains('hero') ? 0 : r.top + scrollY - 88 - parseFloat(getComputedStyle(el).scrollMarginTop);
    return { id: el.id || 'top', at: Math.round(Math.max(0, Math.min(at, document.documentElement.scrollHeight - innerHeight))), height: Math.round(r.height) };
  }),
  state: () => ({
    y: Math.round(scrollY),
    dot: document.querySelector('.rail a.on')?.getAttribute('href') ?? null,
    menu: [...document.querySelectorAll('.nav-link.active')].map((a) => a.getAttribute('href')),
  }),
  layout: async () => {
    const out = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`page wider than the window (${document.documentElement.scrollWidth} > ${innerWidth})`);
    if (/\{\{|\}\}|undefined|\[object/.test(document.body.innerText)) out.push('template leftovers in the text');
    if (document.querySelectorAll('h1').length !== 1) out.push('not exactly one h1');
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    if (new Set(ids).size !== ids.length) out.push('duplicate ids');
    for (const a of document.querySelectorAll('a[href^="#"]')) if (a.getAttribute('href').length > 1 && !document.getElementById(a.getAttribute('href').slice(1))) out.push(`link to missing ${a.getAttribute('href')}`);
    for (const img of document.querySelectorAll('img')) {
      if (!img.hasAttribute('alt')) out.push(`image without alt: ${img.src}`);
      const ok = await fetch(img.currentSrc || img.src, { method: 'HEAD' }).then((r) => r.ok).catch(() => false);
      if (!ok) out.push(`broken image: ${img.getAttribute('src')}`);
    }
    for (const a of document.querySelectorAll('a[href]:not([href^="#"]):not([href^="mailto:"]):not([href^="http"])')) {
      const ok = await fetch(a.href, { method: 'HEAD' }).then((r) => r.ok).catch(() => false);
      if (!ok) out.push(`broken link: ${a.getAttribute('href')}`);
    }
    for (const el of document.querySelectorAll('button, a, input')) if (!(el.innerText || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.labels?.length || '').toString().trim()) out.push(`control without a name: ${el.outerHTML.slice(0, 60)}`);
    // Text that sticks out of the header, or a header on two lines.
    const top = document.querySelector('.top');
    if (top) {
      if (top.getBoundingClientRect().height > 72) out.push(`header is ${Math.round(top.getBoundingClientRect().height)} px tall: something wraps`);
      for (const el of top.querySelectorAll('a, button')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > innerWidth + 1 || r.left < -1)) out.push(`header item outside the window: ${el.textContent.trim() || el.className}`); }
    }
    return out;
  },
};

// --- The checks
const results = [];
const note = (where, what, ok, detail = '') => { results.push({ where, what, ok, detail }); if (!ok) console.log(`  ✗ ${where} · ${what}${detail ? ' — ' + detail : ''}`); };

// A stray closing brace silently switches off every rule after it: the stylesheet's braces must balance at each line.
{
  let depth = 0; const stray = [];
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/assets/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, '')).split('\n').forEach((line, n) => {
    depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length;
    if (depth < 0) { stray.push(n + 1); depth = 0; }
  });
  note('styles.css', 'braces balance', !stray.length && depth === 0, `stray at line ${stray.join(', ')}; ${depth} left open`);
}

async function checkHome(path, size) {
  const where = `/${path} ${size.join('×')}`;
  const page = await openPage(path, size);
  const slides = size[0] >= 901 && size[1] >= 600;
  try {
    const layout = await page.run(inPage.layout);
    note(where, 'layout', !layout.length, layout.join('; '));
    let stops = await page.run(inPage.stops);

    if (slides) {
      // Every section but the long story fits the window when the page stops on it.
      for (const s of stops) {
        if (['top', 'how', 'notify'].includes(s.id)) continue;
        const room = size[1] - 84 + await page.run((id) => parseFloat(getComputedStyle(document.getElementById(id)).paddingTop), s.id);
        note(where, `#${s.id} fits the window`, s.height <= room + 1, `${s.height} px for ${Math.round(room)}`);
      }
      // The side rail has one dot per section, and each one lands on its section.
      const rail = await page.run(() => [...document.querySelectorAll('.rail a')].map((a) => a.getAttribute('href')));
      note(where, 'rail has one dot per section', rail.join() === stops.map((s) => '#' + s.id).join(), rail.join());
      for (const href of rail) {
        await page.click(`.rail a[href="${href}"]`);
        await page.settle();
        stops = await page.run(inPage.stops);
        const want = stops.find((s) => '#' + s.id === href).at, st = await page.run(inPage.state);
        note(where, `rail ${href} lands`, Math.abs(st.y - want) <= 2 && st.dot === href, `y=${st.y} want=${want} dot=${st.dot}`);
      }
      // The menu: each link lands on its own section, which alone is underlined.
      const menu = await page.run(() => [...document.querySelectorAll('.nav-link[href^="#"]')].map((a) => a.getAttribute('href')));
      for (const href of menu) {
        await page.click(`.nav-link[href="${href}"]`);
        await page.settle();
        stops = await page.run(inPage.stops);
        const want = stops.find((s) => '#' + s.id === href).at, st = await page.run(inPage.state);
        note(where, `menu ${href} lands`, Math.abs(st.y - want) <= 2 && st.menu.join() === href && st.dot === href, `y=${st.y} want=${want} menu=${st.menu} dot=${st.dot}`);
      }
      // The logo goes back to the very top.
      await page.click('.brand');
      note(where, 'logo goes to the top', await page.settle() === 0);
      // One flick of the wheel, one section — down the page, then back up.
      const trail = [];
      for (let i = 1; i < stops.length; i++) {
        if (stops[i].id === 'how') {
          // Arriving on the daily story: the first activity is the one lit, and the scene is whole.
          await page.flick(1);
          const at = await page.settle();
          await sleep(500);
          stops = await page.run(inPage.stops);
          const first = await page.run(() => {
            const w = document.querySelector('#how .window').getBoundingClientRect();
            return { on: [...document.querySelectorAll('#how .step')].map((el) => +el.classList.contains('on')).join(''), top: Math.round(w.top), bottom: Math.round(w.bottom), h: innerHeight };
          });
          note(where, 'story: arrives on the first activity, scene whole', first.on === '10000' && first.top >= 72 && first.bottom <= first.h, JSON.stringify(first));
          trail.push(`how:${Math.abs(at - stops[i].at) <= 2 ? 'ok' : `y=${at} want=${stops[i].at}`}`);
          await sleep(200);
          continue;
        }
        if (stops[i - 1].id === 'how') {
          // The daily story: each flick lands on the next activity, in order, with the tree whole beside it.
          const seen = [];
          for (let n = 0; n < 6; n++) {
            await page.flick(1);
            const at = await page.settle();
            stops = await page.run(inPage.stops);
            if (Math.abs(at - stops[i].at) <= 2) break;
            await sleep(500);
            seen.push(await page.run(() => {
              const on = [...document.querySelectorAll('#how .step')].map((el, k) => el.classList.contains('on') ? k : -1).filter((k) => k >= 0);
              const w = document.querySelector('#how .window').getBoundingClientRect();
              return on.join('+') + (w.top >= 72 && w.bottom <= innerHeight ? '' : ' tree cut');
            }));
          }
          note(where, 'story: one flick per activity', seen.join() === '1,2,3', seen.join());
          const y = await page.run(() => Math.round(scrollY));
          trail.push(`${stops[i].id}:${Math.abs(y - stops[i].at) <= 2 ? 'ok' : `y=${y} want=${stops[i].at}`}`);
          // Arriving on the assessment by the wheel, as a visitor does: the pointer comes in and the demonstration plays.
          await sleep(1500);
          const v1 = await page.run(() => { const v = document.querySelector('.app-watch video'); return { hint: document.querySelector('.app-phone').classList.contains('hint-on'), paused: v.paused, t: v.currentTime }; });
          await sleep(700);
          const v2 = await page.run(() => document.querySelector('.app-watch video').currentTime);
          note(where, 'assessment by wheel: pointer and video start', v1.hint && !v1.paused && v2 !== v1.t, JSON.stringify({ ...v1, later: v2 }));
          await sleep(400);
          await page.flick(-1);
          await page.settle(); await sleep(700);
          const back = await page.run(() => ({ on: [...document.querySelectorAll('#how .step')].map((el) => +el.classList.contains('on')).join(''), y: Math.round(scrollY), box: Math.round(document.querySelectorAll('#how .step')[3].getBoundingClientRect().top) }));
          note(where, 'story: back up lands on its last activity', back.on === '00010', JSON.stringify(back));
          await page.flick(1); await page.settle();
          // Coming back to the assessment: the demonstration starts again from standing.
          await sleep(1500);
          const again = await page.run(() => { const v = document.querySelector('.app-watch video'); return { hint: document.querySelector('.app-phone').classList.contains('hint-on'), paused: v.paused, t: v.currentTime }; });
          await sleep(700);
          const moved = await page.run(() => document.querySelector('.app-watch video').currentTime);
          note(where, 'assessment again: video restarts', again.hint && !again.paused && moved !== again.t && again.t < 4, JSON.stringify({ ...again, later: moved }));
          await sleep(200);
          continue;
        }
        await page.flick(1);
        const y = await page.settle();
        stops = await page.run(inPage.stops);
        trail.push(`${stops[i].id}:${Math.abs(y - stops[i].at) <= 2 ? 'ok' : `y=${y} want=${stops[i].at}`}`);
        await sleep(200);
      }
      note(where, 'wheel moves one section at a time', trail.every((t) => t.endsWith(':ok')), trail.filter((t) => !t.endsWith(':ok')).join(' '));
      await page.flick(-1);
      let y = await page.settle();
      note(where, 'wheel goes back up one section', Math.abs(y - stops.at(-2).at) <= 2, `y=${y} want=${stops.at(-2).at}`);
      // The keyboard too.
      await page.click('.brand'); await page.settle();
      await page.key('PageDown'); y = await page.settle();
      note(where, 'PageDown moves one section', Math.abs(y - stops[1].at) <= 2, `y=${y} want=${stops[1].at}`);
      // Two flicks in a row, the second before the page has landed: two sections, without waiting.
      await page.click('.brand'); await page.settle();
      await page.flick(1); await page.flick(1); y = await page.settle();
      stops = await page.run(inPage.stops);
      note(where, 'two flicks in a row move two sections', Math.abs(y - stops[2].at) <= 2, `y=${y} want=${stops[2].at}`);
    } else {
      note(where, 'rail hidden on small screens', await page.run(() => getComputedStyle(document.querySelector('.rail')).display === 'none'));
      if (size[0] <= 900) {
        await page.click('.menu-toggle');
        note(where, 'menu opens', await page.run(() => document.querySelector('.top').classList.contains('open') && document.querySelector('.nav-link').getBoundingClientRect().height > 0));
        await page.click('.nav-link[href="#team"]');
        await page.settle();
        note(where, 'menu link goes to its section and closes the menu', await page.run(() => { const r = document.getElementById('team').getBoundingClientRect(); return !document.querySelector('.top').classList.contains('open') && r.top < innerHeight * .5 && r.bottom > innerHeight * .5; }));
      }
    }

    // The assessment: pointer and demonstration on arrival, then the test itself.
    if (slides) await page.click('.rail a[href="#evaluation"]');
    else await page.run(() => { const b = document.getElementById('did-it'); scrollTo({ top: b.getBoundingClientRect().bottom + scrollY - innerHeight + 60, behavior: 'instant' }); });
    await page.settle(); await sleep(700);
    const before = await page.run(() => { const v = document.querySelector('.app-watch video'), b = document.getElementById('did-it').getBoundingClientRect(); return { hint: document.querySelector('.app-phone').classList.contains('hint-on'), t: v.currentTime, paused: v.paused, button: b.top >= 60 && b.bottom <= innerHeight }; });
    await sleep(900);
    const after = await page.run(() => document.querySelector('.app-watch video').currentTime);
    note(where, 'button fully on screen on arrival', before.button);
    // Nothing inside the phone of the assessment sticks out of its screen, whatever the size of the section.
    const out = await page.run(() => { const s = document.querySelector('.app-screen').getBoundingClientRect(); return [...document.querySelectorAll('.app-watch > *, .app-watch .btn, .app-watch video')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.left < s.left - 1 || r.right > s.right + 1); }).map((el) => el.className || el.tagName); });
    note(where, 'assessment phone holds its content', !out.length, out.join(', '));
    note(where, 'pointer arrives on the button', before.hint);
    note(where, 'demonstration plays on arrival', !before.paused && after > before.t, `t ${before.t.toFixed(1)} → ${after.toFixed(1)}`);
    await page.click('#did-it'); await sleep(400);
    const test = await page.run(() => {
      const phone = document.querySelector('.app-phone'), range = document.getElementById('range-test'), img = document.getElementById('range-img');
      const first = img.getAttribute('src');
      range.value = 7; range.dispatchEvent(new Event('input', { bubbles: true }));
      const pain = document.querySelector('#range-pain input');
      pain.value = 5; pain.dispatchEvent(new Event('input', { bubbles: true }));
      return { tried: phone.classList.contains('tried'), pointerGone: getComputedStyle(phone.querySelector('.tap-hint')).display === 'none', image: img.getAttribute('src') !== first,
        dots: getComputedStyle(document.querySelector('.app-dots')).visibility !== 'hidden' && getComputedStyle(document.querySelector('.app-dots')).display !== 'none' && +getComputedStyle(document.querySelector('.app-dots')).opacity > 0,
        pain: document.querySelector('#range-pain .pscale-n').textContent };
    });
    note(where, 'pressing the button opens the slider', test.tried && test.pointerGone && test.dots, JSON.stringify(test));
    note(where, 'slider changes the picture', test.image);
    note(where, 'pain scale answers', test.pain === '5', test.pain);

    // Every image and clip has loaded once the whole page has been seen.
    const media = await page.run(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * .8) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 120)); }
      // The app screens are a sideways strip on small screens: swipe through it.
      const strip = document.querySelector('.phones');
      if (strip) { strip.scrollIntoView({ block: 'center', behavior: 'instant' }); for (let x = 0; x <= strip.scrollWidth; x += 150) { strip.scrollLeft = x; await new Promise((r) => setTimeout(r, 80)); } }
      await new Promise((r) => setTimeout(r, 900));
      return [...[...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.getAttribute('src')),
        ...[...document.querySelectorAll('video')].filter((v) => v.error || !v.currentSrc).map((v) => v.dataset.src)];
    });
    note(where, 'all images and clips load', !media.length, media.join(', '));
    // The app screens keep the proportions of a phone, and narrow windows get a strip to slide instead of thin columns.
    const screens = await page.run(() => ({ ratios: [...document.querySelectorAll('.phone img')].map((i) => { const r = i.getBoundingClientRect(); return +(r.width / r.height).toFixed(2); }), width: Math.round(document.querySelector('.phone img').getBoundingClientRect().width), strip: getComputedStyle(document.querySelector('.phones')).display === 'flex' }));
    note(where, 'app screens keep their proportions', screens.ratios.every((r) => Math.abs(r - 0.46) <= 0.01) && screens.width >= 150 && screens.strip === (size[0] <= 1100), JSON.stringify(screens));
    note(where, 'no script or network error', !page.errors().length, page.errors().join(' | '));
  } catch (e) { note(where, 'check ran', false, e.message); }
  await page.close();
}

async function checkProgram(path, size) {
  const where = `/${path} ${size.join('×')}`;
  const page = await openPage(path, size);
  try {
    const layout = await page.run(inPage.layout);
    note(where, 'layout', !layout.length, layout.join('; '));
    note(where, 'sources listed', await page.run(() => document.querySelectorAll('.sources a[href^="http"]').length) === 4);
    note(where, 'no script or network error', !page.errors().length, page.errors().join(' | '));
  } catch (e) { note(where, 'check ran', false, e.message); }
  await page.close();
}

// --- Run
const profile = mkdtempSync(join(tmpdir(), 'bth-check-'));
const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs')], { env: { ...process.env, PORT }, stdio: 'ignore' });
const browser = spawn(chrome, ['--headless=new', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
let failed = 1;
try {
  let info;
  for (let i = 0; i < 50 && !info; i++) { await sleep(200); info = await fetch(`http://127.0.0.1:${DEBUG}/json/version`).then((r) => r.json()).catch(() => null); }
  if (!info) throw new Error('The browser did not start.');
  socket = new WebSocket(info.webSocketDebuggerUrl);
  socket.addEventListener('message', onMessage);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });

  const only = process.argv[2]; // npm test -- 1280x720
  for (const size of SIZES) {
    if (only && only !== size.join('x')) continue;
    console.log(`${size.join('×')}`);
    for (const path of HOMES) await checkHome(path, size);
    for (const path of PROGRAMS) await checkProgram(path, size);
  }
  failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} checks passed, ${failed} failed.`);
} finally {
  socket?.close(); browser.kill(); server.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
