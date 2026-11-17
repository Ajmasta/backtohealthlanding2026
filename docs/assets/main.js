// Motion for the site. Without this script (or with reduced motion) the page is complete and still.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) document.documentElement.classList.add('no-motion');

  var top = document.querySelector('.top');
  function onScroll() { top.classList.toggle('scrolled', scrollY > 24); }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // One section at a time (wide screens): one scroll gesture glides the page to the next section, slowly,
  // starting and landing softly, instead of leaving the page between two sections.
  // A section taller than the window scrolls normally until its end. Touch and the scrollbar stay free.
  var slides = matchMedia('(min-width: 901px) and (min-height: 600px)');
  var stops = [].slice.call(document.querySelectorAll('.hero, .band, .night'));
  var gliding = false, goal = 0, lastWheel = 0, peak = 0, trough = 0, taken = 0, pushed = 0, free = false, frame = 0;
  function stopAt(el) {
    var r = el.getBoundingClientRect();
    if (el.classList.contains('night')) return r.bottom + scrollY - innerHeight;
    if (el.classList.contains('hero')) return 0;
    return r.top + scrollY - 88 - parseFloat(getComputedStyle(el).scrollMarginTop);
  }
  // The page answers at once and lands softly: a slow start feels like the page resists.
  function ease(t) { return 1 - Math.pow(1 - t, 3.2); }
  // `to` is a position, or a function giving it: a section may still move while the page finishes loading,
  // and the glide then follows it to where it really is.
  function glide(to) {
    var aim = typeof to === 'function' ? to : function () { return to; };
    function end() { return Math.max(0, Math.min(aim(), document.documentElement.scrollHeight - innerHeight)); }
    to = goal = end();
    var from = scrollY, distance = to - from;
    if (Math.abs(distance) < 2) return;
    cancelAnimationFrame(frame);
    if (reduce) { scrollTo({ top: to, behavior: 'instant' }); return; }
    // Longer trips take longer, within reason: about two thirds of a second for one section.
    var length = Math.max(480, Math.min(950, 380 + Math.abs(distance) * .4)), start = performance.now();
    gliding = true;
    (function step(now) {
      var t = Math.min(1, (now - start) / length);
      scrollTo({ top: from + ((goal = end()) - from) * ease(t), behavior: 'instant' });
      if (t < 1) frame = requestAnimationFrame(step); else { gliding = false; if (typeof mark === 'function') mark(); }
    })(start);
  }
  // Every place a gesture can land: each section, and inside the daily story each activity, centred beside
  // its tree. Places too close to the one before are dropped.
  var story = [].slice.call(document.querySelectorAll('#how .step:not(.step-end)'));
  function places() {
    var how = document.getElementById('how'), tale = how && story.length && slides.matches, middle = 0;
    var grid = how && how.querySelector('.water-grid'), scene = how && how.querySelector('.window'), closing = how && how.querySelector('.step-end');
    if (how && !tale) { grid.style.removeProperty('--stage-top'); if (closing) closing.style.minHeight = ''; }
    if (tale) {
      // The scene sticks in the middle of the window, but never lower than where it sits when the section
      // arrives (a very tall window): the first activity is then the one beside it.
      var arrival = grid.getBoundingClientRect().top + scrollY - stopAt(how);
      var stick = Math.max(88, Math.min(innerHeight / 2 - scene.offsetHeight / 2, arrival));
      grid.style.setProperty('--stage-top', Math.round(stick) + 'px');
      middle = stick + scene.offsetHeight / 2;
      // Room under the last activity, so that it too can come beside the scene before the section ends.
      var lastStep = story[story.length - 1];
      if (closing) closing.style.minHeight = Math.max(0, Math.round(innerHeight - middle - lastStep.offsetHeight / 2 - parseFloat(getComputedStyle(how).paddingBottom))) + 'px';
    }
    var limit = document.documentElement.scrollHeight - innerHeight, gap = Math.min(innerHeight * .25, 240);
    function within(y) { return Math.max(0, Math.min(y, limit)); }
    // The sections first; an activity is added only where it is not too close to a place already there.
    var list = stops.map(function (el) { return within(stopAt(el)); });
    if (tale) {
      var end = how.getBoundingClientRect().bottom + scrollY - innerHeight;
      story.forEach(function (step) {
        var r = step.getBoundingClientRect(), y = within(Math.min(end, r.top + r.height / 2 + scrollY - middle));
        if (list.every(function (other) { return Math.abs(other - y) >= gap; })) list.push(y);
      });
    }
    return list.sort(function (x, y) { return x - y; }).filter(function (y, i, all) { return !i || y - all[i - 1] > 4; });
  }
  // Where one gesture leads from here, or null when the next place is more than a window away:
  // a very tall section scrolls freely until its end comes near.
  // During a glide the next place is counted from where the glide is heading, so gestures can follow one
  // another without waiting for the page to land.
  function neighbour(down) {
    var list = places(), target = null, here = gliding ? goal : scrollY;
    if (down) { for (var i = 0; i < list.length; i++) if (list[i] > here + 4) { target = list[i]; break; } }
    else { for (var j = list.length - 1; j >= 0; j--) if (list[j] < here - 4) { target = list[j]; break; } }
    // The ending is always one gesture away from the last section, whatever lies between.
    var last = list[list.length - 1], reach = innerHeight * ((down && target === last) || (!down && here >= last - 4) ? 2 : 1.15);
    if (target === null || Math.abs(target - here) > reach) return null;
    return target;
  }
  addEventListener('wheel', function (e) {
    if (reduce || !slides.matches || e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    // A gesture is a run of wheel events with no pause; a trackpad keeps sending them long after the fingers lift.
    var fresh = e.timeStamp - lastWheel > 160;
    lastWheel = e.timeStamp;
    // A trackpad also keeps sending fading events after a swipe: a second swipe arrives in the middle of
    // them, with no pause, and shows only as a push that had faded and grows again. It is a new gesture too,
    // even while the page is still gliding.
    var size = Math.abs(e.deltaY) * (e.deltaMode ? 32 : 1);
    var again = !fresh && pushed === Infinity && size > 30 && trough < peak * .4 && size > trough * 2.5 && e.timeStamp - taken > 200;
    if (size > peak) peak = trough = size; else if (size < trough) trough = size;
    if (fresh || again) { pushed = 0; free = false; }
    // One gesture moves one section: the rest of it is swallowed, during the glide and after.
    if (pushed === Infinity) { e.preventDefault(); return; }
    // A gesture that scrolled inside a tall section keeps doing only that.
    if (free) return;
    var target = neighbour(e.deltaY > 0);
    if (target === null) { if (gliding) e.preventDefault(); else free = true; return; }
    e.preventDefault();
    // A light brush of the wheel is not a decision to leave the section.
    pushed += e.deltaY * (e.deltaMode ? 32 : 1);
    if (Math.abs(pushed) < 16) return;
    pushed = Infinity; peak = trough = size; taken = e.timeStamp;
    glide(target);
  }, { passive: false });
  // The keyboard moves the same way.
  addEventListener('keydown', function (e) {
    if (reduce || !slides.matches || e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY|VIDEO)$/.test(e.target.tagName)) return;
    var down = e.key === 'PageDown' || e.key === 'ArrowDown' || (e.key === ' ' && !e.shiftKey);
    var up = e.key === 'PageUp' || e.key === 'ArrowUp' || (e.key === ' ' && e.shiftKey);
    if (!down && !up) return;
    var target = neighbour(down);
    if (target === null) return;
    e.preventDefault();
    if (!gliding || !e.repeat) glide(target);
  });
  // Links to a section of this page glide there too.
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href^="#"]');
    var el = link && link.getAttribute('href').length > 1 && document.getElementById(link.getAttribute('href').slice(1));
    if (!el || reduce || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    history.pushState(null, '', link.getAttribute('href'));
    glide(function () { return el === top ? 0 : stops.indexOf(el) >= 0 ? stopAt(el) : el.getBoundingClientRect().top + scrollY - 88; });
  });

  // Small screens: the menu button opens the section links; choosing one, or Escape, closes it.
  var toggle = top.querySelector('.menu-toggle');
  function setMenu(open) {
    top.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
  }
  toggle.addEventListener('click', function () { setMenu(!top.classList.contains('open')); });
  top.querySelectorAll('.nav-link').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // Where the page is: the side rail fills the dot of the section in view, and the menu underlines
  // its link only while that very section is on screen (not through the sections that follow it).
  var links = [].slice.call(top.querySelectorAll('.nav-link[href^="#"]'));
  var rail = document.querySelector('.rail'), dotsOfRail = rail ? [].slice.call(rail.querySelectorAll('a')) : [];
  var marking = 0;
  function mark() {
    marking = 0;
    var current = 0, line = scrollY + innerHeight * .4;
    stops.forEach(function (el, i) { if (el.getBoundingClientRect().top + scrollY <= line) current = i; });
    // At the very bottom of the page the last section is the one in view, however short it is.
    if (scrollY >= document.documentElement.scrollHeight - innerHeight - 2) current = stops.length - 1;
    var here = '#' + (stops[current].id || 'top');
    links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === here); });
    dotsOfRail.forEach(function (a) {
      var on = a.getAttribute('href') === here;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    // Over the night sky the dots turn light.
    if (rail) rail.classList.toggle('light', stops[current].classList.contains('night'));
  }
  addEventListener('scroll', function () { if (!marking) marking = requestAnimationFrame(mark); }, { passive: true });
  addEventListener('resize', mark);
  mark();

  // Sections rise as they arrive (260 ms, no bounce).
  var revealer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('seen'); revealer.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { revealer.observe(el); });

  // A teardrop falls from above the scene to the crest, squashes, and the ground ripples.
  var DROP = 'M13 0C16 6 26 15 26 26A13 13 0 1 1 0 26C0 15 10 6 13 0Z';
  function fallingDrop(scene, color, done) {
    var crest = scene.querySelector('.crest');
    var distance = crest.getBoundingClientRect().top - scene.getBoundingClientRect().top + 40;
    var el = document.createElement('div');
    el.className = 'drop';
    el.innerHTML = '<svg viewBox="0 0 26 42"><path fill="' + color + '" d="' + DROP + '"/><ellipse cx="8" cy="26" rx="2.5" ry="5" fill="rgba(255,255,255,.75)"/></svg>';
    crest.appendChild(el);
    var fall = el.animate([
      { transform: 'translateY(' + -distance + 'px) scale(.9, 1)', offset: 0 },
      { transform: 'translateY(-38px) scale(.88, 1.2)', offset: .82 },
      { transform: 'translateY(-14px) scale(1.8, .3)', opacity: 1, offset: .92 },
      { transform: 'translateY(-10px) scale(2, .2)', opacity: 0, offset: 1 }
    ], { duration: 950, easing: 'cubic-bezier(.5, 0, .9, .6)', fill: 'forwards' });
    fall.onfinish = function () { el.remove(); };

    setTimeout(function () {
      [0, 180, 360].forEach(function (delay) {
        var r = document.createElement('div');
        r.className = 'ripple';
        r.style.color = color;
        crest.appendChild(r);
        r.animate([
          { transform: 'scale(.08)', opacity: .9 },
          { transform: 'scale(1)', opacity: 0 }
        ], { duration: 950, delay: delay, easing: 'ease-out' }).onfinish = function () { r.remove(); };
      });
      [-1, -.6, -.25, .25, .6, 1].forEach(function (dir, i) {
        var d = document.createElement('div');
        d.className = 'droplet';
        d.style.color = color;
        crest.appendChild(d);
        var x = dir * (30 + i * 3), up = 34 - Math.abs(dir) * 12;
        d.animate([
          { transform: 'translate(0, 0)', opacity: 1 },
          { transform: 'translate(' + x * .6 + 'px, ' + -up + 'px)', opacity: 1, offset: .5 },
          { transform: 'translate(' + x + 'px, 4px)', opacity: 0 }
        ], { duration: 520, easing: 'ease-out' }).onfinish = function () { d.remove(); };
      });
      if (done) done();
    }, 780);
  }

  // Slides: a section whose content leaves the window half empty is shown larger, up to 1.4 times,
  // until it takes about four fifths of the height. Phones and tablets scroll freely and stay as they are.
  (function () {
    var bands = [].slice.call(document.querySelectorAll('.band:not(#how)'));
    function tall(band) {
      var top = Infinity, bottom = -Infinity;
      for (var i = 0; i < band.children.length; i++) {
        var r = band.children[i].getBoundingClientRect();
        if (!r.height) continue;
        top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom);
      }
      return bottom - top;
    }
    function fill() {
      var room = (innerHeight - 84) * .8;
      bands.forEach(function (band) {
        band.style.removeProperty('--z');
        if (!slides.matches || tall(band) >= room) return;
        var low = 1, high = 1.4;
        for (var i = 0; i < 6; i++) {
          var z = (low + high) / 2;
          band.style.setProperty('--z', z.toFixed(3));
          if (tall(band) > room) high = z; else low = z;
        }
        band.style.setProperty('--z', low.toFixed(3));
      });
      places();
      mark();
    }
    fill();
    addEventListener('resize', fill);
    addEventListener('load', fill);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fill);
  })();

  // Hero: the tree and the phone take the room the text leaves above the hill, whatever the window.
  (function () {
    var scene = document.querySelector('[data-scene="hero"]'), text = scene && scene.querySelector('.hero-text');
    if (!text) return;
    var wide = matchMedia('(min-width: 601px)');
    function fit() {
      if (!wide.matches) { scene.style.removeProperty('--tree-h'); return; }
      var words = text.lastElementChild.getBoundingClientRect().bottom - text.firstElementChild.getBoundingClientRect().top;
      // From under the header to the crest of the hill, less the text and some air; the phone is 1.1 tree tall.
      var room = (scene.offsetHeight * .86 - 96 - words - 56) / 1.1;
      scene.style.setProperty('--tree-h', Math.round(Math.max(170, Math.min(room, 480))) + 'px');
    }
    fit();
    addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  })();

  // Hero: planting. The drop lands on the empty hill, the tree springs up from the ground and settles, then sways.
  var hero = document.querySelector('[data-scene="hero"]');
  if (!reduce && hero.animate) {
    var heroTree = hero.querySelector('.tree-wrap');
    heroTree.style.transform = 'scale(0)';
    setTimeout(function () {
      fallingDrop(hero, '#37b5ff', function () {
        heroTree.animate([
          { transform: 'scale(0, 0)' },
          { transform: 'scale(.55, .8)', offset: .35 },
          { transform: 'scale(1.1, 1.06)', offset: .65 },
          { transform: 'rotate(-2deg) scale(.97, .99)', offset: .82 },
          { transform: 'rotate(1deg) scale(1.01)', offset: .92 },
          { transform: 'scale(1)' }
        ], { duration: 1600, delay: 80, easing: 'cubic-bezier(.25, .8, .35, 1)', fill: 'forwards' }).onfinish = settle;
      });
    }, 300);
  }

  // Once planted, the tree lives quietly in its corner: an uneven breeze (in CSS) and, now and then, a leaf
  // that lets go and drifts down. Only while the hero is on screen.
  var LEAVES = ['#59dee7', '#37b5ff', '#5074ff', '#8fd9a8'];
  function settle() {
    heroTree.classList.add('alive');
    var visible = true, timer;
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(hero);
    (function next() {
      timer = setTimeout(function () { if (visible && !document.hidden) leaf(); next(); }, 3500 + Math.random() * 4000);
    })();
  }
  function leaf() {
    var el = document.createElement('div');
    el.className = 'leaf';
    el.style.color = LEAVES[Math.floor(Math.random() * LEAVES.length)];
    el.style.left = 25 + Math.random() * 50 + '%';
    el.style.top = 18 + Math.random() * 30 + '%';
    heroTree.appendChild(el);
    var side = Math.random() < .5 ? -1 : 1, fall = heroTree.offsetHeight * (.45 + Math.random() * .2);
    el.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 0 },
      { transform: 'translate(' + side * 14 + 'px, ' + fall * .25 + 'px) rotate(' + side * 70 + 'deg)', opacity: 1, offset: .15 },
      { transform: 'translate(' + side * -6 + 'px, ' + fall * .55 + 'px) rotate(' + side * -30 + 'deg)', opacity: 1, offset: .55 },
      { transform: 'translate(' + side * 30 + 'px, ' + fall + 'px) rotate(' + side * 110 + 'deg)', opacity: 0 }
    ], { duration: 4200 + Math.random() * 1500, easing: 'ease-in-out' }).onfinish = function () { el.remove(); };
  }

  // Water: each activity reached sends its drop, and the tree moves to the next of its four stages.
  var win = document.querySelector('[data-scene="window"]');
  var stages = [].slice.call(win.querySelectorAll('.stage'));
  var steps = [].slice.call(document.querySelectorAll('.step'));
  var reached = -1;
  // One color per activity, as in the app; the closing line sends no drop.
  var STEP_COLORS = ['#59dee7', '#37b5ff', '#5074ff', '#8fd9a8'];

  function setStage(n) {
    stages.forEach(function (s) { s.classList.toggle('on', +s.dataset.stage === n); });
  }
  function show(index, animate) {
    steps.forEach(function (s, i) { s.classList.toggle('on', i === index); });
    var stage = Math.min(index, 3) + 1;
    var color = STEP_COLORS[index];
    if (animate && color && win.animate) fallingDrop(win, color, function () { setStage(stage); });
    else setStage(stage);
  }
  // Reduced motion and no-JS keep the full tree from the markup.
  if (!reduce) {
    setStage(1);
    var picker = new IntersectionObserver(function (entries) {
      if (slides.matches) return;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = steps.indexOf(e.target);
        show(i, i > reached);
        reached = Math.max(reached, i);
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(function (s) { picker.observe(s); });
    // Wide screens: the activity in view is the one beside the tree, whatever the height of the window
    // (the middle of a very tall window is already the second activity when the section arrives).
    var current = -1, queued = false;
    function beside() {
      queued = false;
      if (!slides.matches) return;
      var box = win.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) return;
      var middle = (box.top + box.bottom) / 2, best = 0, least = Infinity;
      steps.forEach(function (step, i) {
        if (step.classList.contains('step-end')) return;
        var r = step.getBoundingClientRect(), off = Math.abs((r.top + r.bottom) / 2 - middle);
        if (off < least) { least = off; best = i; }
      });
      if (best === current) return;
      current = best;
      show(best, best > reached);
      reached = Math.max(reached, best);
    }
    function ask() { if (!queued) { queued = true; requestAnimationFrame(beside); } }
    addEventListener('scroll', ask, { passive: true });
    addEventListener('resize', ask);
    ask();
  }

  // Videos load only when they come into view, and pause when they leave it. With reduced motion they
  // stay on their still picture, with controls to play them on demand.
  var player = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        if (!v.src) v.src = v.dataset.src;
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else if (v.src) v.pause();
    });
  }, { threshold: .25 });
  document.querySelectorAll('.lazy-video').forEach(function (v) {
    if (reduce) { v.src = v.dataset.src; v.controls = true; v.loop = false; }
    // The demonstration in the phone is started by the movement test itself, below.
    else if (!v.closest('.app-phone')) player.observe(v);
  });

  // The pain scale, as in the app (PainScale): a disc with the number in its clinical colour, the band
  // and what the number means. `start` null means no answer yet: no thumb until the scale is touched.
  var COLORS = ['#3db86b', '#68c062', '#89c855', '#a6cf45', '#d5cd41', '#ffc93c', '#ffaf40', '#ff9443', '#fb824a', '#f76f4e', '#f25a52'];
  var SCALE = window.PAIN.scale;
  function painScale(root, start, onChange) {
    var input = root.querySelector('input');
    var answered = start !== null;
    function show() {
      var v = +input.value;
      root.classList.toggle('unset', !answered);
      root.style.setProperty('--dot', answered ? COLORS[v] : '');
      root.querySelector('.pscale-n').textContent = answered ? v : '?';
      root.querySelector('.pscale-band').textContent = answered ? SCALE.bands[v === 0 ? 0 : v <= 3 ? 1 : v <= 6 ? 2 : 3] : SCALE.unset;
      root.querySelector('.pscale-meaning').textContent = answered && v > 0 ? SCALE.meaning[v] : '';
      onChange(answered ? v : null);
    }
    function answer() { answered = true; show(); }
    input.value = answered ? start : 0;
    input.addEventListener('input', answer);
    // A first touch counts even on the current value, as in the app.
    input.addEventListener('pointerdown', answer);
    show();
  }

  // The movement test, as in the app: watch the demo, then slide through 10 pictures to the furthest
  // position reached and rate the pain.
  var phone = document.querySelector('.app-phone');
  if (phone) {
    var rangeTest = document.getElementById('range-test');
    var rangeImg = document.getElementById('range-img');
    var rangeResult = document.getElementById('range-result');
    var testPain = null;
    var frames = [];
    for (var f = 0; f < 10; f++) { frames[f] = new Image(); frames[f].src = phone.dataset.frames + f + '.webp'; }
    var showResult = function () {
      var n = +rangeTest.value;
      rangeImg.src = frames[n].src;
      rangeTest.style.setProperty('--fill', n / 9 * 100 + '%');
      if (!phone.classList.contains('ranging')) { rangeResult.textContent = ''; return; }
      rangeResult.textContent = (testPain === null ? rangeResult.dataset.unset : rangeResult.dataset.set).replace('{n}', n + 1).replace('{p}', testPain);
    };
    rangeTest.addEventListener('input', showResult);
    painScale(document.querySelector('#range-pain .pscale'), null, function (v) { testPain = v; showResult(); });
    // Two steps, as in the app. The dots under the phone go back and forth between them.
    var dots = [].slice.call(document.querySelectorAll('.app-dot'));
    var setStep = function (step) {
      phone.classList.toggle('ranging', step === 1);
      dots.forEach(function (d, i) { d.classList.toggle('on', i === step); d.setAttribute('aria-current', i === step ? 'step' : 'false'); });
      showResult();
    };
    // Once the person has pressed the button, the pointer has done its job: it does not come back.
    document.getElementById('did-it').addEventListener('click', function () { phone.classList.add('tried'); setStep(1); });
    dots.forEach(function (d) { d.addEventListener('click', function () { setStep(+d.dataset.step); }); });
    setStep(0);
    // The pointer comes in each time the person arrives on the button, as long as they have not pressed it:
    // when the button is fully in the window and the page has stopped moving,
    // so the arrival is seen from its start. It stays and keeps tapping; leaving the section resets it.
    var didIt = document.getElementById('did-it'), lastMove = 0, waiting = 0;
    // Measured, not observed: an observer asked for "fully visible" never fires when the enlarged section
    // leaves the button a fraction of a pixel short of whole.
    function inPlace() {
      var r = didIt.getBoundingClientRect();
      return r.height > 0 && r.top >= 60 && r.bottom <= innerHeight - 8;
    }
    addEventListener('scroll', function () { lastMove = Date.now(); clearTimeout(waiting); waiting = setTimeout(arrive, 200); }, { passive: true });
    addEventListener('resize', function () { clearTimeout(waiting); waiting = setTimeout(arrive, 200); });
    addEventListener('load', function () { waiting = setTimeout(arrive, 200); });
    function arrive() {
      clearTimeout(waiting);
      if (!inPlace() || phone.classList.contains('hint-on')) return;
      if (Date.now() - lastMove < 180) { waiting = setTimeout(arrive, 90); return; }
      phone.classList.add('hint-on');
    }
    // The demonstration has one owner, and one rule: it plays from standing whenever half of it is in the
    // window, and goes back to standing once it has left. It is fetched as soon as the page has loaded
    // (it is small), so it is ready before the person gets there.
    // The clip from the app is a slow 16 seconds. The file here is already sped up (6 seconds, see
    // make-evaluation-media.sh): asking the browser to play the slow one fast made it stutter.
    var demo = phone.querySelector('.app-watch video');
    if (demo && !reduce) {
      var playing = false;
      var fetchDemo = function () { if (!demo.src) { demo.preload = 'auto'; demo.src = demo.dataset.src; demo.load(); } };
      var watch = function () {
        var r = demo.getBoundingClientRect();
        var seen = r.height > 0 ? (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height : 0;
        if (seen >= .5 && !document.hidden) {
          fetchDemo();
          if (!demo.paused && playing) return;
          playing = true;
          var p = demo.play();
          // A browser that refuses to start it (energy saving, for one) leaves the person a play button.
          if (p && p.catch) p.catch(function (err) { if (err && err.name === 'NotAllowedError') demo.controls = true; });
        } else if (seen <= 0 && playing) {
          playing = false;
          demo.pause();
          try { demo.currentTime = 0; } catch (e) {}
        }
      };
      // Whenever the browser has more of the clip ready, or the page comes back to the front: try again.
      ['loadeddata', 'canplay', 'stalled', 'suspend'].forEach(function (name) { demo.addEventListener(name, watch); });
      document.addEventListener('visibilitychange', watch);
      addEventListener('scroll', watch, { passive: true });
      addEventListener('resize', watch);
      addEventListener('load', function () { fetchDemo(); watch(); });
      document.getElementById('did-it').addEventListener('click', function () { setTimeout(watch, 0); });
      dots.forEach(function (d) { d.addEventListener('click', function () { setTimeout(watch, 0); }); });
      if (document.readyState === 'complete') fetchDemo();
      watch();
    }
    // Gone from the window altogether: the next arrival plays again.
    new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) phone.classList.remove('hint-on');
    }).observe(phone);
    waiting = setTimeout(arrive, 200);
  }

  // Pain during a session: the same rule as the app (domain/dosing): above 3 stop, exactly 3 hold, 2 or less move on.
  var card = document.querySelector('.pain-card');
  var reply = document.getElementById('pain-reply');
  painScale(card.querySelector('.pscale'), +card.dataset.painStart, function (v) {
    var kind = v > 3 ? 'stop' : v === 3 ? 'hold' : 'easy';
    reply.classList.toggle('stop', kind === 'stop');
    reply.querySelector('h3').textContent = window.PAIN[kind + 'Title'];
    reply.querySelector('p').textContent = window.PAIN[kind + 'Body'];
  });
})();
