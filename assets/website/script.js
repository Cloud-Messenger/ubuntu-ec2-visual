(function () {
  'use strict';
  var TITLES = [
    { id: 'midnight-protocol', t: 'Midnight Protocol', c: 'Sci-Fi', y: 2026, d: 'A cloud engineer discovers a server that answers requests from the future.' },
    { id: 'neon-harbor', t: 'Neon Harbor', c: 'Action', y: 2025, d: 'A smuggler pilot has one night to cross a flooded megacity.' },
    { id: 'the-last-signal', t: 'The Last Signal', c: 'Sci-Fi', y: 2026, d: 'A lone radio operator hears a message that should be impossible.' },
    { id: 'paper-moons', t: 'Paper Moons', c: 'Drama', y: 2024, d: 'Three sisters rebuild a small theatre and the family it once held together.' },
    { id: 'iron-orchard', t: 'Iron Orchard', c: 'Action', y: 2025, d: 'In a rusted farmland republic, a mechanic leads a quiet uprising.' },
    { id: 'glass-city', t: 'Glass City', c: 'Drama', y: 2026, d: 'Architects, rivals and secrets rise together in a city made of light.' },
    { id: 'ember-run', t: 'Ember Run', c: 'Action', y: 2023, d: 'A relay of firefighters races a wildfire across three mountain ranges.' },
    { id: 'deep-current', t: 'Deep Current', c: 'Documentary', y: 2025, d: 'Scientists follow the ocean conveyor that shapes every coastline on Earth.' },
    { id: 'laugh-track', t: 'Laugh Track', c: 'Comedy', y: 2024, d: 'A failing sitcom writers’ room accidentally invents a real superstar.' },
    { id: 'echoes-of-mars', t: 'Echoes of Mars', c: 'Sci-Fi', y: 2026, d: 'The first colony wakes to find its own voices coming back from the canyons.' },
    { id: 'quiet-frequency', t: 'Quiet Frequency', c: 'Documentary', y: 2024, d: 'A sound designer maps the hidden noise of everyday life.' },
    { id: 'the-long-orbit', t: 'The Long Orbit', c: 'Drama', y: 2023, d: 'A decade-long mission tests the crew’s friendships more than their ship.' }
  ];
  var CATS = ['All', 'Action', 'Sci-Fi', 'Drama', 'Comedy', 'Documentary'];
  var $ = function (id) { return document.getElementById(id); };
  var state = { cat: 'All', q: '', list: [], current: null, timer: null };
  try { state.list = JSON.parse(localStorage.getItem('cloudflix-list') || '[]'); } catch (e) { state.list = []; }
  function save() { try { localStorage.setItem('cloudflix-list', JSON.stringify(state.list)); } catch (e) {} }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('show'); }, 1800); }
  function tile(it) {
    var b = document.createElement('div');
    b.className = 'tile'; b.tabIndex = 0; b.setAttribute('role', 'button'); b.setAttribute('aria-label', it.t + ', ' + it.c);
    var inList = state.list.indexOf(it.id) > -1;
    b.innerHTML = '<img loading="lazy" alt="' + it.t + ' poster" src="assets/' + it.id + '.svg"><div class="cap"><b>' + it.t + '</b><small>' + it.c + ' · ' + it.y + '</small></div>' +
      '<button class="add' + (inList ? ' in' : '') + '" aria-label="' + (inList ? 'Remove from' : 'Add to') + ' My List">' + (inList ? '✓' : '+') + '</button>';
    b.addEventListener('click', function (e) { if (e.target.classList.contains('add')) { toggleList(it); e.stopPropagation(); } else openModal(it); });
    b.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target === b) openModal(it); });
    return b;
  }
  function fill(el, arr) { el.innerHTML = ''; arr.forEach(function (it) { el.appendChild(tile(it)); }); }
  function byId(id) { return TITLES.filter(function (x) { return x.id === id; })[0]; }
  function render() {
    var q = state.q.trim().toLowerCase();
    var filtered = TITLES.filter(function (x) { return (state.cat === 'All' || x.c === state.cat) && (!q || (x.t + ' ' + x.c).toLowerCase().indexOf(q) > -1); });
    fill($('grid'), filtered);
    $('empty').hidden = filtered.length > 0;
    $('browseTitle').textContent = state.cat === 'All' ? 'Browse All' : 'Browse: ' + state.cat;
    fill($('trendTrack'), TITLES.slice(0, 8));
    var mine = state.list.map(byId).filter(Boolean);
    fill($('listTrack'), mine); $('listEmpty').hidden = mine.length > 0;
  }
  function toggleList(it) {
    var i = state.list.indexOf(it.id);
    if (i > -1) { state.list.splice(i, 1); toast('Removed from My List'); } else { state.list.push(it.id); toast('Added to My List'); }
    save(); render(); if (state.current === it) syncModalBtn();
  }
  function syncModalBtn() { $('mList').textContent = state.list.indexOf(state.current.id) > -1 ? '✓ In My List' : '+ My List'; }
  function stopPlay() { clearInterval(state.timer); $('player').hidden = true; $('barFill').style.width = '0'; $('mPlay').textContent = '▶ Play'; }
  function startPlay(it) {
    var p = 0; $('player').hidden = false; $('mPlay').textContent = '■ Stop';
    $('playTxt').textContent = 'Now playing (demo): ' + it.t;
    clearInterval(state.timer);
    state.timer = setInterval(function () { p += 4; $('barFill').style.width = Math.min(p, 100) + '%'; if (p >= 100) { clearInterval(state.timer); $('playTxt').textContent = 'Demo finished. No real video is streamed.'; $('mPlay').textContent = '↺ Replay'; } }, 250);
  }
  function openModal(it) {
    state.current = it; stopPlay();
    $('mPoster').innerHTML = '<img alt="" src="assets/' + it.id + '.svg">';
    $('mTitle').textContent = it.t; $('mMeta').textContent = it.c + ' · ' + it.y + ' · Demo title'; $('mDesc').textContent = it.d;
    syncModalBtn(); $('modal').hidden = false; $('mClose').focus();
  }
  function closeModal() { stopPlay(); $('modal').hidden = true; state.current = null; }
  CATS.forEach(function (c) {
    var b = document.createElement('button'); b.className = 'chip' + (c === 'All' ? ' on' : ''); b.textContent = c; b.setAttribute('role', 'tab');
    b.addEventListener('click', function () { state.cat = c; Array.prototype.forEach.call($('chips').children, function (x) { x.classList.toggle('on', x === b); }); render(); });
    $('chips').appendChild(b);
  });
  $('search').addEventListener('input', function (e) { state.q = e.target.value; render(); if (state.q) $('browse').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('playBtn').addEventListener('click', function () { openModal(TITLES[0]); startPlay(TITLES[0]); });
  $('infoBtn').addEventListener('click', function () { openModal(TITLES[0]); });
  $('mPlay').addEventListener('click', function () { if ($('player').hidden || $('mPlay').textContent.indexOf('Replay') > -1) startPlay(state.current); else stopPlay(); });
  $('mList').addEventListener('click', function () { toggleList(state.current); });
  $('mClose').addEventListener('click', closeModal);
  $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });
  window.addEventListener('scroll', function () { $('nav').classList.toggle('solid', window.scrollY > 40); }, { passive: true });
  render();
})();
