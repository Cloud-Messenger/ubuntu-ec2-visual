/* app.js – UI controller: sidebar, autoplay, caption card, preview, theme, final animation. */
(function (root) {
  'use strict';
  var doc = root.document, STEPS = root.STEPS, Anim = root.Anim, IP = root.PUBLIC_IP;
  var $ = function (id) { return doc.getElementById(id); };
  var AUTOPLAY_MS = 5000;
  var state = { step: 1, done: {}, playing: false, mode: 'b', tab: 'learn', theme: 'dark' };
  var autoTimer = null, finalTimers = [], confettiRaf = null;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function store(k, v) { try { if (v === undefined) return root.localStorage.getItem(k); root.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } return null; }

  /* ---------- sidebar ---------- */
  function buildSidebar() {
    var ol = $('stepList'); ol.innerHTML = '';
    STEPS.forEach(function (s) {
      var li = doc.createElement('li'); li.setAttribute('data-n', s.n);
      li.innerHTML = '<button type="button" aria-label="Step ' + s.n + ': ' + esc(s.label) + '"><span class="num">' + s.n + '</span><span class="lbl">' + esc(s.label) + '</span><span class="ico" aria-hidden="true">' + s.icon + '</span></button>';
      li.firstChild.addEventListener('click', function () { userGo(s.n); });
      ol.appendChild(li);
    });
  }
  function updateSidebar() {
    var n = 0;
    Array.prototype.forEach.call($('stepList').children, function (li) {
      var k = +li.getAttribute('data-n'), done = !!state.done[k];
      li.classList.toggle('active', k === state.step); li.classList.toggle('done', done);
      li.querySelector('.num').textContent = done && k !== state.step ? '✓' : k;
      var b = li.firstChild; if (k === state.step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      if (done) n++;
    });
    var pct = Math.round(n / STEPS.length * 100);
    $('pct').textContent = pct + '%'; $('progFill').style.width = pct + '%';
    $('prog').setAttribute('aria-valuenow', pct);
  }

  /* ---------- caption card ---------- */
  function cmdBlock(c) {
    return '<div class="cmd-row"><pre class="code"><button class="copy" type="button" data-copy="' + esc(c.c).replace(/"/g, '&quot;') + '">copy</button>$ ' + esc(c.c) + '</pre>' + (c.note ? '<small>' + esc(c.note) + '</small>' : '') + '</div>';
  }
  function renderCaption() {
    var s = STEPS[state.step - 1], b = '';
    $('capTitle').textContent = s.icon + ' Step ' + s.n + ' · ' + s.title; $('capStory').textContent = s.story;
    if (state.tab === 'learn') {
      b += '<h3>' + (state.mode === 'b' ? 'In plain words' : 'Technical explanation') + '</h3><p>' + esc(state.mode === 'b' ? s.simple : s.technical) + '</p>';
      b += '<h3>Real-world analogy</h3><p class="analogy">' + esc(s.analogy) + '</p><h3>Key concepts</h3><div class="concepts">';
      s.concepts.forEach(function (c) { b += '<details><summary>' + esc(c.t) + '</summary><p>' + esc(c.d) + '</p></details>'; });
      b += '</div>';
    } else if (state.tab === 'cmd') {
      b += '<h3>Commands</h3>' + s.commands.map(cmdBlock).join('') + '<h3>Expected output</h3><pre class="code">' + esc(s.output) + '</pre><p class="t-d" style="color:var(--dim);font-size:.82rem">Output is an example; IDs, dates and IPs will differ in your account.</p>';
    } else if (state.tab === 'pit') {
      b += '<h3>Common mistakes</h3><ul>' + s.mistakes.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul><h3>Troubleshooting tip</h3><p class="tipbox">💡 ' + esc(s.tip) + '</p>';
    } else {
      b += '<h3>Interview question</h3><div class="qa"><b>' + esc(s.interview.q) + '</b><br><button type="button" id="ansBtn">Show answer</button><p class="ans" id="ans" hidden>' + esc(s.interview.a) + '</p></div>';
    }
    $('capBody').innerHTML = b;
    Array.prototype.forEach.call($('capTabs').children, function (t) { var on = t.getAttribute('data-tab') === state.tab; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
    var ab = $('ansBtn'); if (ab) ab.addEventListener('click', function () { var a = $('ans'); a.hidden = !a.hidden; ab.textContent = a.hidden ? 'Show answer' : 'Hide answer'; });
  }

  /* ---------- website preview ---------- */
  var ERR_PAGE = '<body style="font:16px system-ui;background:#1f1f24;color:#e8e8ee;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div><div style="font-size:48px">☹️</div><h2 style="margin:6px 0">This site can’t be reached</h2><p style="color:#9aa">%MSG%</p><code style="color:#9aa">ERR_CONNECTION_TIMED_OUT</code></div></body>';
  var NGX_PAGE = '<body style="font-family:Tahoma,Verdana,Arial,sans-serif;background:#fff;color:#111;padding:16px;margin:0"><h1 style="font-weight:600">Welcome to nginx!</h1><p>If you see this page, the nginx web server is successfully installed and working. Further configuration is required.</p><p>For online documentation and support please refer to <a href="https://nginx.org/">nginx.org</a>.<br>Commercial support is available at <a href="https://nginx.com/">nginx.com</a>.</p><p><em>Thank you for using nginx.</em></p></body>';
  var pvKey = '';
  function siteMode() {
    var h = Anim.health || {}, site = h.site && h.site[0], http = h.http && h.http[0], ec2 = h.ec2 && h.ec2[0];
    if (state.step < 7) return 'none';
    if (state.step === 7) return 'default';
    if (state.step === 9 && (site === 'bad' || http === 'bad' || ec2 === 'bad')) return 'down';
    if (state.step === 9 && site === 'warn') return 'default';
    return 'live';
  }
  function renderPreview() {
    var m = siteMode(), key = m + '|' + (m === 'none' ? state.step : ''); if (key === pvKey) return; pvKey = key;
    var f = $('pvFrame'), st = $('pvState'), note = $('pvNote');
    if (m === 'live') { f.removeAttribute('srcdoc'); f.src = 'assets/website/index.html'; st.textContent = '● live'; st.className = 'pv-state live'; note.textContent = 'CloudFlix is served from /var/www/html by NGINX. Try Play, More Info, search and the category chips: it is a real, working page.'; }
    else if (m === 'default') { f.removeAttribute('src'); f.srcdoc = NGX_PAGE; st.textContent = '● default NGINX page'; st.className = 'pv-state warn'; note.textContent = 'NGINX is installed, but your website files are not in /var/www/html yet (Step 8 deploys them).'; }
    else if (m === 'down') { f.removeAttribute('src'); f.srcdoc = ERR_PAGE.replace('%MSG%', 'An incident is active. Diagnose and fix it below.'); st.textContent = '● unreachable'; st.className = 'pv-state bad'; note.textContent = 'The preview reflects the control-room health: it recovers when you verify the fix.'; }
    else { f.removeAttribute('src'); f.srcdoc = ERR_PAGE.replace('%MSG%', 'Nothing is serving a website yet.'); st.textContent = '● not deployed'; st.className = 'pv-state bad'; note.textContent = 'Before Step 7 there is no web server, so a browser would fail. The preview updates as you progress.'; }
  }

  /* ---------- navigation ---------- */
  function showStep(n) {
    state.step = Math.max(1, Math.min(STEPS.length, n));
    $('stageNo').textContent = state.step; $('stageTitle').textContent = STEPS[state.step - 1].title;
    $('termCard').hidden = state.step < 5; $('tsCard').hidden = state.step !== 9;
    if (state.step >= 5) root.Terminal.setScenario(state.step);
    if (state.step === 9) root.Anim.resetHealth();
    Anim.show(state.step); pvKey = ''; renderCaption(); renderPreview(); updateSidebar();
    var sc = $('scene'); sc.classList.remove('fade');
  }
  function userGo(n) { stopAuto(); setPlayUI(false); showStep(n); }
  function next() { if (state.step < STEPS.length) showStep(state.step + 1); else openFinal(); }
  function prev() { showStep(state.step - 1); }

  /* ---------- autoplay (every 5 s) ---------- */
  function setPlayUI(on) { state.playing = on; $('playBtn').textContent = on ? '⏸ Pause' : '▶ Play'; $('playBtn').setAttribute('aria-pressed', on); $('tickLbl').textContent = on ? 'Autoplay on · next step in 5 s' : 'Autoplay off · every 5 s'; if (!on) { var t = $('tickFill'); t.style.transition = 'none'; t.style.width = '0'; } }
  function armTick() { var t = $('tickFill'); t.style.transition = 'none'; t.style.width = '0'; void t.offsetWidth; t.style.transition = 'width ' + AUTOPLAY_MS + 'ms linear'; t.style.width = '100%'; }
  function stopAuto() { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; } }
  function schedule() {
    stopAuto(); if (!state.playing) return; armTick();
    autoTimer = setTimeout(function () {
      if (!state.playing) return;
      if (state.step < STEPS.length) { showStep(state.step + 1); schedule(); }
      else { setPlayUI(false); openFinal(); }
    }, AUTOPLAY_MS);
  }
  function togglePlay() { if (state.playing) { stopAuto(); setPlayUI(false); } else { setPlayUI(true); schedule(); } }
  function reset() {
    stopAuto(); setPlayUI(false); state.done = {}; state.tab = 'learn'; root.Troubleshoot.reset(); root.Anim.resetHealth(); showStep(1);
  }

  /* ---------- theme / mode ---------- */
  function setTheme(t) { state.theme = t; doc.documentElement.setAttribute('data-theme', t); $('themeBtn').textContent = t === 'dark' ? '🌙' : '☀️'; $('themeBtn').setAttribute('aria-label', 'Switch to ' + (t === 'dark' ? 'light' : 'dark') + ' theme'); store('cm-theme', t); }
  function setMode(m) { state.mode = m; $('modeB').classList.toggle('on', m === 'b'); $('modeT').classList.toggle('on', m === 't'); $('modeB').setAttribute('aria-pressed', m === 'b'); $('modeT').setAttribute('aria-pressed', m === 't'); renderCaption(); store('cm-mode', m); }

  /* ---------- final cinematic animation ---------- */
  var LAYERS = ['☁️ AWS CLOUD', '🏢 PHYSICAL SERVER', '🖥️ HYPERVISOR / NITRO ARCHITECTURE', '🐧 UBUNTU EC2 INSTANCE', '🔐 SECURITY GROUP', '💻 SSH CONNECTION', '⚙️ NGINX WEB SERVER', '📄 HTML + CSS + JAVASCRIPT', '🌐 LIVE WEBSITE'];
  function confetti() {
    var c = $('confetti'), ctx = c.getContext && c.getContext('2d'); if (!ctx) return;
    c.width = root.innerWidth; c.height = root.innerHeight;
    var cols = ['#e50914', '#ff9900', '#e95420', '#2fd47a', '#5b8cff', '#fff'], P = [];
    for (var i = 0; i < 140; i++) P.push({ x: Math.random() * c.width, y: -Math.random() * c.height, r: 3 + Math.random() * 5, v: 2 + Math.random() * 3.5, s: Math.random() * 2 - 1, c: cols[i % cols.length] });
    var t0 = Date.now();
    (function tick() {
      ctx.clearRect(0, 0, c.width, c.height);
      P.forEach(function (p) { p.y += p.v; p.x += p.s + Math.sin(p.y / 30); if (p.y > c.height) { p.y = -10; p.x = Math.random() * c.width; } ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.r, p.r * 1.6); });
      if (Date.now() - t0 < 9000 && !$('final').hidden) confettiRaf = root.requestAnimationFrame(tick); else ctx.clearRect(0, 0, c.width, c.height);
    })();
  }
  function openFinal() {
    var f = $('final'); f.hidden = false; doc.body.style.overflow = 'hidden';
    finalTimers.forEach(clearTimeout); finalTimers = [];
    var ol = $('finalStack'); ol.innerHTML = ''; $('finalMsg').classList.remove('show'); $('finalFrame').removeAttribute('src');
    LAYERS.forEach(function (t, i) {
      if (i) { var a = doc.createElement('li'); a.className = 'arrow'; a.textContent = '↓'; ol.appendChild(a); }
      var li = doc.createElement('li'); li.textContent = t; ol.appendChild(li);
    });
    var items = Array.prototype.slice.call(ol.children);
    items.forEach(function (li, i) { finalTimers.push(setTimeout(function () { li.classList.add('show'); }, 250 + i * 140)); });
    finalTimers.push(setTimeout(function () { $('finalMsg').classList.add('show'); $('finalFrame').src = 'assets/website/index.html'; confetti(); }, 250 + items.length * 140 + 250));
    state.done[STEPS.length] = true; updateSidebar(); $('finalClose').focus();
  }
  function closeFinal() { $('final').hidden = true; doc.body.style.overflow = ''; finalTimers.forEach(clearTimeout); if (confettiRaf) root.cancelAnimationFrame(confettiRaf); }

  /* ---------- init ---------- */
  function init() {
    buildSidebar(); Anim.init($('stage'));
    root.Terminal.init({ out: $('termOut'), input: $('termIn'), prompt: $('termPrompt'), explorer: $('termExplorer') });
    root.Troubleshoot.init($('tsRoot'));
    Anim.onBeat(function (e) {
      $('beatLabel').textContent = e.caption;
      if (e.beat >= e.max && e.max > 0 && e.step === state.step && !state.done[e.step]) { state.done[e.step] = true; updateSidebar(); }
    });
    if (Anim.onHealth) Anim.onHealth(function () { renderPreview(); });
    $('prevBtn').addEventListener('click', function () { stopAuto(); setPlayUI(false); prev(); });
    $('nextBtn').addEventListener('click', function () { stopAuto(); setPlayUI(false); next(); });
    $('playBtn').addEventListener('click', togglePlay);
    $('resetBtn').addEventListener('click', reset);
    $('finalBtn').addEventListener('click', function () { stopAuto(); setPlayUI(false); openFinal(); });
    $('finalClose').addEventListener('click', closeFinal); $('finalDone').addEventListener('click', closeFinal); $('finalReplay').addEventListener('click', openFinal);
    $('themeBtn').addEventListener('click', function () { setTheme(state.theme === 'dark' ? 'light' : 'dark'); });
    $('modeB').addEventListener('click', function () { setMode('b'); }); $('modeT').addEventListener('click', function () { setMode('t'); });
    $('capTabs').addEventListener('click', function (e) { var t = e.target.closest('button'); if (t) { state.tab = t.getAttribute('data-tab'); renderCaption(); } });
    $('capBody').addEventListener('click', function (e) { var b = e.target.closest('.copy'); if (!b) return; var txt = b.getAttribute('data-copy'); try { root.navigator.clipboard.writeText(txt); } catch (err) { /* clipboard unavailable */ } b.textContent = 'copied'; setTimeout(function () { b.textContent = 'copy'; }, 1200); });
    doc.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'Escape' && !$('final').hidden) closeFinal();
      else if (!$('final').hidden) return;
      else if (e.key === 'ArrowRight') { stopAuto(); setPlayUI(false); next(); } else if (e.key === 'ArrowLeft') { stopAuto(); setPlayUI(false); prev(); }
      else if (e.key === ' ' && tag !== 'button') { e.preventDefault(); togglePlay(); }
    });
    var th = store('cm-theme'); if (th !== 'light' && th !== 'dark') { th = root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
    setTheme(th); var md = store('cm-mode'); if (md === 't') state.mode = 't'; setMode(state.mode);
    var h = parseInt((root.location.hash || '').replace('#', ''), 10);
    showStep(h >= 1 && h <= 9 ? h : 1);
    root.addEventListener('hashchange', function () { var n = parseInt((root.location.hash || '').replace('#', ''), 10); if (n >= 1 && n <= 9 && n !== state.step) userGo(n); });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  root.CMApp = { go: userGo, next: next, prev: prev, togglePlay: togglePlay, reset: reset, openFinal: openFinal, state: state };
})(window);
