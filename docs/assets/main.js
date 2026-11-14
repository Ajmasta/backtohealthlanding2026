// Motion for the site. Without this script (or with reduced motion) the page is complete and still.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) document.documentElement.classList.add('no-motion');

  var top = document.querySelector('.top');
  function onScroll() { top.classList.toggle('scrolled', scrollY > 24); }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Small screens: the menu button opens the section links; choosing one, or Escape, closes it.
  var toggle = top.querySelector('.menu-toggle');
  function setMenu(open) {
    top.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
  }
  toggle.addEventListener('click', function () { setMenu(!top.classList.contains('open')); });
  top.querySelectorAll('.nav-link').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // The menu underlines the section in view.
  var links = [].slice.call(top.querySelectorAll('.nav-link[href^="#"]'));
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id); });
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  links.forEach(function (a) { var s = document.querySelector(a.getAttribute('href')); if (s) spy.observe(s); });

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
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = steps.indexOf(e.target);
        show(i, i > reached);
        reached = Math.max(reached, i);
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(function (s) { picker.observe(s); });
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
    else player.observe(v);
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
