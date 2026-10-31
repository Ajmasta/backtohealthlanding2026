// Motion for the site. Without this script (or with reduced motion) the page is complete and still.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) document.documentElement.classList.add('no-motion');

  var top = document.querySelector('.top');
  function onScroll() { top.classList.toggle('scrolled', scrollY > 24); }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

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

  // Hero: planting. The drop lands on the empty hill and the tree grows, one small overshoot.
  var hero = document.querySelector('[data-scene="hero"]');
  if (!reduce && hero.animate) {
    var heroTree = hero.querySelector('.tree-wrap');
    heroTree.style.transform = 'scale(0)';
    setTimeout(function () {
      fallingDrop(hero, '#37b5ff', function () {
        heroTree.animate([
          { transform: 'scale(0)' },
          { transform: 'scale(1.05)', offset: .75 },
          { transform: 'scale(1)' }
        ], { duration: 1200, delay: 120, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'forwards' });
      });
    }, 350);
  }

  // Water: each activity reached sends its drop, and the sprout grows. The fourth makes it the tree.
  var win = document.querySelector('[data-scene="window"]');
  var sprout = win.querySelector('.sprout-wrap');
  var steps = [].slice.call(document.querySelectorAll('.step'));
  var SIZES = [.5, .68, .86, 1];
  var reached = -1;

  function show(index, animate) {
    steps.forEach(function (s, i) { s.classList.toggle('on', i === index); });
    var growth = Math.min(index, 3);
    function apply() {
      sprout.style.setProperty('--s', SIZES[Math.max(growth, 0)]);
      win.classList.toggle('full', index >= 3);
    }
    var color = steps[index].dataset.color;
    if (animate && color && !reduce && win.animate) fallingDrop(win, color, apply);
    else apply();
  }
  if (reduce) { sprout.style.opacity = 0; win.classList.add('full'); }
  else {
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

  // Pain: the same rule as the app (domain/dosing): above 3 stop, exactly 3 hold, 2 or less move on.
  var COLORS = ['#3db86b', '#68c062', '#89c855', '#a6cf45', '#d5cd41', '#ffc93c', '#ffaf40', '#ff9443', '#fb824a', '#f76f4e', '#f25a52'];
  var range = document.getElementById('pain-range');
  var out = document.getElementById('pain-out');
  var reply = document.getElementById('pain-reply');
  var card = range.closest('.pain-card');
  function render() {
    var v = +range.value;
    var kind = v > 3 ? 'stop' : v === 3 ? 'hold' : 'easy';
    out.textContent = v;
    card.style.setProperty('--dot', COLORS[v]);
    reply.classList.toggle('stop', kind === 'stop');
    reply.querySelector('h3').textContent = window.PAIN[kind + 'Title'];
    reply.querySelector('p').textContent = window.PAIN[kind + 'Body'];
  }
  range.addEventListener('input', render);
  render();
})();
