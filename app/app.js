// Entrenador · app (PWA). Habla con Entreno.gs por POST; sin servidor propio ni dependencias.
// Las acciones sencillas (hoy no puedo, mover, cerrar, series) van directas al código, nunca pasan por la IA.
(function () {
  'use strict';

  // ------------------------------------------------------------------ utilidades
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('ent.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ent.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento: seguimos */ } },
    del(k) { try { localStorage.removeItem('ent.' + k); } catch (e) { /* nada */ } },
  };
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DC = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => { d = new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const pdate = s => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); };
  const addDays = (s, n) => { const d = pdate(s); d.setDate(d.getDate() + n); return ymd(d); };
  const dow = s => pdate(s).getDay();
  const mondayOf = s => addDays(s, -((dow(s) + 6) % 7));
  const today = () => ymd(new Date());
  const longDay = s => { const d = pdate(s); return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()]; };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const whenTxt = s => s === today() ? 'Hoy' : s === addDays(today(), 1) ? 'Mañana' : cap(DIAS[dow(s)]) + ' ' + pdate(s).getDate();
  const mmss = sec => Math.floor(sec / 60) + ':' + pad(Math.max(0, sec % 60));
  const addMin = (hm, m) => { const [h, mi] = hm.split(':').map(Number); const t = h * 60 + mi + m; return pad(Math.floor(t / 60) % 24) + ':' + pad(t % 60); };
  const ICON = {
    chev: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5.5 1 1 1.5 2 1.5 3.5C12 9 12 6 12 3z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L19 7"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  };
  const TIPO_CLASS = t => t === 'fuerza' ? 'f' : ['carrera', 'bici', 'natacion'].indexOf(t) >= 0 ? 'c' : 'd';
  const LUGAR = { gym: 'Gimnasio', casa: 'En casa', calle: 'Calle', bici: 'Bici', piscina: 'Piscina', corta: 'Versión corta' };
  const back = (href, label) => '<a class="back" href="' + href + '">' + ICON.back + esc(label) + '</a>';

  // ------------------------------------------------------------------ configuración y API
  let cfg = LS.get('cfg', null);
  // enlace de instalación: …/#u=<url de la API>&k=<clave>
  (function readSetupHash() {
    const m = location.hash.match(/^#u=([^&]+)&k=([^&]+)/);
    if (m) { cfg = { url: decodeURIComponent(m[1]), key: decodeURIComponent(m[2]) }; LS.set('cfg', cfg); history.replaceState(null, '', location.pathname + '#/inicio'); }
  })();

  async function api(action, body) {
    body = body || {};
    if (!cfg) throw new Error('Falta configurar la app.');
    if (cfg.demo) return Demo.call(action, body);
    const res = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ k: cfg.key, action }, body)) });
    if (!res.ok) throw new Error('El servidor ha respondido ' + res.status + '.');
    let j;
    try { j = await res.json(); } catch (e) { throw new Error('Respuesta rara del servidor: ¿has publicado la nueva versión del script?'); }
    if (j.error) throw new Error(j.error === 'clave' ? 'La clave no es correcta: revísala en Ajustes.' : j.error);
    return j;
  }

  // lecturas con copia local: si no hay conexión se enseña lo último que se vio
  let offline = false;
  async function read(action, body, key) {
    key = key || action;
    try {
      const j = await api(action, body);
      LS.set('cache.' + key, { at: Date.now(), data: j });
      offline = false;
      flushOutbox();
      return j;
    } catch (e) {
      const c = LS.get('cache.' + key, null);
      if (c) { offline = 'Sin conexión: datos de hace ' + ago(c.at) + '.'; return c.data; }
      throw e;
    }
  }
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' días'; };

  // las series del gimnasio se guardan aunque no haya cobertura y se mandan después
  async function sendSet(b) {
    try { await api('log_set', b); } catch (e) { const o = LS.get('outbox', []); o.push(b); LS.set('outbox', o); }
  }
  let flushing = false;
  async function flushOutbox() {
    const o = LS.get('outbox', []);
    if (!o.length || flushing || !cfg || cfg.demo) return;
    flushing = true;
    const rest = [];
    for (const b of o) { try { await api('log_set', b); } catch (e) { rest.push(b); } }
    LS.set('outbox', rest);
    flushing = false;
  }
  window.addEventListener('online', flushOutbox);

  // acción que cambia algo: aviso con Deshacer
  async function act(action, body, after) {
    try {
      const r = await api(action, body);
      toast(r.msg || 'Hecho.', r.undo ? async () => { const u = await api('undo', { undo: r.undo }); toast(u.msg); render(); } : null);
      if (after) after(r); else render();
      return r;
    } catch (e) { toast('⚠️ ' + e.message); }
  }

  // ------------------------------------------------------------------ aviso y hoja inferior
  let toastTimer = null;
  function toast(msg, undo) {
    const t = $('#toast');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button type="button">Deshacer</button>' : '');
    t.hidden = false;
    if (undo) t.querySelector('button').onclick = () => { t.hidden = true; undo(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, undo ? 9000 : 5000);
  }
  function sheet(html, bind) {
    const s = $('#sheet');
    s.querySelector('.sheet-panel').innerHTML = html;
    s.hidden = false;
    if (bind) bind(s.querySelector('.sheet-panel'));
  }
  function closeSheet() { $('#sheet').hidden = true; }
  $('#sheet').addEventListener('click', e => { if (e.target.hasAttribute('data-close')) closeSheet(); });

  // ------------------------------------------------------------------ rutas
  const view = $('#view');
  let timers = [];
  function clearTimers() { timers.forEach(clearInterval); timers = []; }

  async function render() {
    clearTimers();
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const r = parts[0] || 'inicio';
    document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === ({ sesion: 'inicio', gym: 'inicio', ej: 'biblio', ajustes: 'inicio', perfil: 'inicio' }[r] || r)));
    document.body.classList.toggle('full', r === 'gym');
    if (!cfg && r !== 'ajustes') return viewWelcome();
    const fn = { inicio: viewHome, calendario: viewCal, chat: viewChat, biblio: viewBiblio, ej: viewExercise, progreso: viewProgress, perfil: viewProfile, sesion: viewSession, gym: viewGym, ajustes: viewSettings }[r] || viewHome;
    if (!view.children.length || r !== render.last) view.innerHTML = '<div class="spin" aria-label="Cargando"></div>';
    render.last = r;
    try { await fn(parts[1], parts[2]); }
    catch (e) { view.innerHTML = '<div class="head"><h1>Ups</h1></div><div class="card"><p>' + esc(e.message) + '</p><div class="btns"><button class="btn" type="button" id="retry">Reintentar</button><a class="btn soft" href="#/ajustes">Ajustes</a></div></div>'; $('#retry').onclick = render; }
  }
  window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });
  const banner = () => (cfg && cfg.demo ? '<div class="banner">Modo demostración: datos de ejemplo, nada se guarda. Conéctala a tu agenda en <a href="#/ajustes">Ajustes</a>.</div>' : '') + (offline ? '<div class="banner">' + esc(offline) + '</div>' : '');

  // ------------------------------------------------------------------ bienvenida y ajustes
  function viewWelcome() {
    view.innerHTML = '<div class="head"><div><div class="over">Tu entrenador personal</div><h1>Hola</h1></div></div>' +
      '<div class="card"><p>La app se conecta a tu agenda de Google (el mismo script del bot). Abre el enlace que te da <b>setupEntreno()</b> o pega aquí la URL y la clave.</p>' + settingsForm() + '</div>' +
      '<div class="card"><h3>¿Solo quieres verla?</h3><p class="muted">Con datos de ejemplo, sin tocar tu calendario.</p><button class="btn accent" type="button" id="demo">Probar con datos de ejemplo</button></div>';
    bindSettings();
    $('#demo').onclick = () => { cfg = { demo: true }; LS.set('cfg', cfg); location.hash = '#/inicio'; render(); };
  }
  function settingsForm() {
    const c = cfg && !cfg.demo ? cfg : {};
    return '<form id="cfgf" class="card" style="padding:0;gap:12px">' +
      '<label class="field"><span class="label">URL de la API</span><input name="url" type="url" required placeholder="https://script.google.com/macros/s/…/exec?app=entreno" value="' + esc(c.url || '') + '"></label>' +
      '<label class="field"><span class="label">Clave de la app</span><input name="key" required autocomplete="off" value="' + esc(c.key || '') + '"></label>' +
      '<button class="btn" type="submit">Conectar</button></form>';
  }
  function bindSettings() {
    $('#cfgf').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      let url = String(f.get('url')).trim();
      if (url.indexOf('app=entreno') < 0) url += (url.indexOf('?') >= 0 ? '&' : '?') + 'app=entreno';
      const prev = cfg;
      cfg = { url, key: String(f.get('key')).trim() };
      try { await api('state'); LS.set('cfg', cfg); toast('Conectada.'); location.hash = '#/inicio'; render(); }
      catch (err) { cfg = prev; toast('⚠️ No conecta: ' + err.message); }
    };
  }
  function viewSettings() {
    const link = cfg && !cfg.demo ? location.origin + location.pathname + '#u=' + encodeURIComponent(cfg.url) + '&k=' + encodeURIComponent(cfg.key) : '';
    view.innerHTML = '<div class="topbar">' + back('#/perfil', 'Perfil') + '</div><div class="head" style="padding-top:0"><h1>Conexión</h1></div>' +
      '<div class="card">' + (cfg && cfg.demo ? '<p>Ahora estás en <b>modo demostración</b>.</p>' : '') + settingsForm() + '</div>' +
      (link ? '<div class="card"><h3>Instalar en otro móvil</h3><p class="muted small">Este enlace lleva la clave: no lo compartas.</p><button class="btn soft" type="button" id="copy">Copiar enlace de instalación</button></div>' : '') +
      '<div class="card"><div class="btns"><button class="btn line" type="button" id="demo">' + (cfg && cfg.demo ? 'Salir de la demostración' : 'Ver la demostración') + '</button><button class="btn line" type="button" id="clear">Vaciar copia local</button></div>' +
      '<p class="muted small">Pendientes de enviar: ' + LS.get('outbox', []).length + ' series.</p></div>';
    bindSettings();
    if (link) $('#copy').onclick = () => navigator.clipboard.writeText(link).then(() => toast('Copiado.'), () => toast(link));
    $('#demo').onclick = () => { cfg = cfg && cfg.demo ? LS.get('cfg.real', null) : (LS.set('cfg.real', cfg), { demo: true }); LS.set('cfg', cfg); location.hash = '#/inicio'; render(); };
    $('#clear').onclick = () => { Object.keys(localStorage).filter(k => k.indexOf('ent.cache.') === 0).forEach(k => localStorage.removeItem(k)); toast('Copia local vaciada.'); };
  }

  // ------------------------------------------------------------------ inicio
  async function viewHome() {
    const st = await read('state');
    const q = new URLSearchParams(location.search);
    const td = st.today.filter(s => ['planificada', 'reservar', 'hecha', 'a medias'].indexOf(s.estado) >= 0);
    // si ya ha terminado, va a "Por cerrar" y no se repite como sesión de hoy
    const live = td.find(s => (s.estado === 'planificada' || s.estado === 'reservar') && !st.toClose.some(c => c.id === s.id));
    let html = '<div class="head"><div><div class="over">' + esc(cap(longDay(st.hoy))) + '</div><h1>Resumen</h1></div>' +
      '<div style="display:flex;gap:8px;align-items:center"><span class="pill" title="Semanas seguidas cumpliendo el plan">' + ICON.flame + esc(st.streak) + (st.streak === 1 ? ' semana' : ' semanas') + '</span>' +
      '<a class="iconbtn" href="#/perfil" aria-label="Perfil">' + ICON.user + '</a></div></div>' + banner();

    // preguntas del entrenador (p. ej. sesión clave sin hueco)
    st.questions.forEach(b => {
      html += '<section class="card ask"><div class="label">El entrenador pregunta</div><div style="font-weight:600">' + esc(b.texto) + '</div><div class="btns">' +
        b.opciones.map((o, i) => '<button class="btn small ' + (i ? 'line' : 'accent') + '" type="button" data-answer="' + esc(b.id) + '" data-i="' + i + '">' + esc(o) + '</button>').join('') + '</div></section>';
    });
    // sesiones acabadas sin cerrar
    st.toClose.forEach(s => {
      html += '<section class="card"><div class="label">Por cerrar</div><div><b>' + esc(s.titulo) + '</b> <span class="muted">· ' + esc(whenTxt(s.fecha)) + ' ' + esc(s.inicio) + '</span></div>' +
        '<div class="btns"><button class="btn small accent" type="button" data-close-s="' + esc(s.id) + '" data-t="' + esc(s.titulo) + '">¿Cómo ha ido?</button><button class="btn small line" type="button" data-miss="' + esc(s.id) + '">No la hice</button></div></section>';
    });

    if (live) {
      const extra = live.estado === 'reservar' ? '<span class="tag" style="background:#fff;color:var(--accent)">Reserva la piscina</span>' : '';
      html += '<section class="card hero"><div class="topbar"><div class="label">Hoy · ' + esc(live.inicio) + '</div><div class="label" style="text-transform:none">' + esc(LUGAR[live.version] || LUGAR[live.lugar] || '') + ' · ' + esc(live.minutos) + ' min</div></div>' +
        '<div><h2 style="color:#fff">' + esc(live.titulo) + '</h2><div class="sub">' + (live.tipo === 'fuerza' ? 'Semana ' + st.bloque.semana + ' del bloque ' + st.bloque.bloque + (st.bloque.semana === 4 ? ' · descarga' : '') : live.prioridad === 'clave' ? 'Sesión clave de la semana' : 'Suave, a ritmo de conversación') + '</div></div>' + extra +
        '<div class="btns"><a class="btn white grow" href="#/' + (live.tipo === 'fuerza' ? 'gym' : 'sesion') + '/' + esc(live.id) + '">' + (live.tipo === 'fuerza' ? 'Empezar' : 'Ver sesión') + '</a>' +
        '<button class="btn ghost" type="button" data-cant="' + esc(live.id) + '">Hoy no puedo</button></div></section>';
    } else {
      const done = td.find(s => s.estado === 'hecha' || s.estado === 'a medias');
      html += '<section class="card"><div class="label">Hoy</div><h2>' + (done ? esc(done.titulo) + ' ✓' : 'Descanso') + '</h2><div class="muted">' +
        (done ? '¡Hecha! Buen trabajo.' : 'Hoy no hay entreno. Recuperar también es entrenar.') + '</div></section>';
    }

    html += '<section class="card"><div class="rings">' + rings(st.rings) + '<div class="legend"><div class="label" style="display:block">Esta semana</div>' +
      '<div><span style="color:var(--accent)">Fuerza</span><span>' + st.rings.fuerza.join(' / ') + '</span></div>' +
      '<div><span style="color:var(--green)">Cardio</span><span>' + st.rings.cardio.join(' / ') + '</span></div>' +
      '<div><span style="color:var(--blue)">Deporte</span><span>' + st.rings.deporte[0] + '</span></div></div></div>' +
      '<div><div class="label" style="margin-bottom:6px">Cómo va la semana</div><div class="seg" role="group" aria-label="Modo de la semana">' +
      [['normal', 'Normal'], ['corto', 'Poco tiempo'], ['mantenimiento', 'Exámenes']].map(([m, l]) => '<button type="button" data-mode="' + m + '" class="' + (st.modo === m ? 'on' : '') + '">' + l + '</button>').join('') + '</div></div></section>';

    if (st.next.length) {
      html += '<section class="card tight">' + st.next.map(s => sessionRow(s)).join('') + '</section>';
    }
    if (st.goals.length) html += '<section class="card tight">' + st.goals.slice(0, 2).map(g => '<a class="row link" href="#/progreso"><div class="grow"><div class="t">🎯 ' + esc(g.titulo) + '</div><div class="s">' + esc(g.fecha ? 'Para el ' + pdate(g.fecha).getDate() + ' de ' + MESES[pdate(g.fecha).getMonth()] + ' de ' + pdate(g.fecha).getFullYear() : g.detalle) + '</div></div>' + ICON.chev + '</a>').join('') + '</section>';
    view.innerHTML = html;

    view.querySelectorAll('[data-answer]').forEach(b => b.onclick = () => act('answer', { id: b.dataset.answer, option: b.dataset.i }));
    view.querySelectorAll('[data-cant]').forEach(b => b.onclick = () => act('cant', { id: b.dataset.cant }));
    view.querySelectorAll('[data-close-s]').forEach(b => b.onclick = () => closeFlow(b.dataset.closeS, b.dataset.t));
    view.querySelectorAll('[data-miss]').forEach(b => b.onclick = () => act('close', { id: b.dataset.miss, estado: 'no hecha' }));
    view.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { if (!b.classList.contains('on')) modeFlow(b.dataset.mode); });
    // desde el aviso de Telegram: ?sesion=<id>
    if (q.get('sesion')) { const id = q.get('sesion'); history.replaceState(null, '', location.pathname + '#/inicio'); const s = st.toClose.concat(st.today).find(x => x.id === id); if (s && st.toClose.indexOf(s) >= 0) closeFlow(id, s.titulo); else location.hash = '#/sesion/' + id; }
  }

  function sessionRow(s) {
    const d = s.fecha ? pdate(s.fecha) : null;
    const st = { hecha: 'Hecha', 'a medias': 'A medias', 'no hecha': 'No hecha', reservar: 'Reserva la piscina', 'sin hueco': 'Sin hueco esta semana' }[s.estado];
    return '<a class="row link" href="#/sesion/' + esc(s.id) + '"><div class="day ' + TIPO_CLASS(s.tipo) + '">' + (d ? DC[d.getDay()] + '<b>' + d.getDate() + '</b>' : '<b>?</b>') + '</div>' +
      '<div class="grow"><div class="t">' + esc(s.titulo) + '</div><div class="s">' + esc((s.inicio ? s.inicio + ' · ' : '') + (s.minutos ? s.minutos + ' min · ' : '') + (LUGAR[s.version] || LUGAR[s.lugar] || '')) + (st ? ' · ' + esc(st) : '') + '</div></div>' + ICON.chev + '</a>';
  }

  function rings(r) {
    const ring = (rad, [a, b], c, wash) => {
      const L = 2 * Math.PI * rad, f = b ? Math.min(1, a / b) : 0;
      return '<circle cx="52" cy="52" r="' + rad + '" fill="none" stroke="' + wash + '" stroke-width="12"/>' +
        (f ? '<circle cx="52" cy="52" r="' + rad + '" fill="none" stroke="' + c + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (f * L).toFixed(1) + ' ' + L.toFixed(1) + '" transform="rotate(-90 52 52)"/>' : '');
    };
    return '<svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label="Semana: fuerza ' + r.fuerza.join(' de ') + ', cardio ' + r.cardio.join(' de ') + ', deporte ' + r.deporte[0] + '">' +
      ring(44, r.fuerza, '#B83A0B', '#F6DDD2') + ring(29, r.cardio, '#1E7A5E', '#D3E7E0') + ring(14, [r.deporte[0], Math.max(1, r.deporte[0])], '#2457B3', '#D9E3F5') + '</svg>';
  }

  function modeFlow(mode) {
    const txt = { normal: 'Vuelve el plan completo: 3 fuerzas, tirada larga, rodaje y bici o natación.', corto: 'Lo esencial (Fuerza A, Fuerza B y un rodaje) en versión corta. Lo demás se quita de lo que queda de semana.', mantenimiento: 'Dos sesiones cortas de fuerza para no perder lo ganado. Ideal en exámenes.' }[mode];
    sheet('<h2>¿Cambiar la semana?</h2><p>' + txt + '</p><p class="muted small">Reorganizo lo que queda de semana en tus huecos libres. Se puede deshacer.</p><div class="btns"><button class="btn accent grow" type="button" id="ok">Cambiar</button><button class="btn soft" type="button" data-close>Cancelar</button></div>',
      p => { p.querySelector('#ok').onclick = () => { closeSheet(); act('mode', { mode }); }; p.querySelector('[data-close]').onclick = closeSheet; });
  }

  // cerrar una sesión: cómo ha ido, esfuerzo y molestias
  function closeFlow(id, titulo, after) {
    const v = { estado: 'hecha', rpe: '', dolor: '' };
    const scale = (name, from, to) => '<div class="scale' + (to - from === 9 ? ' ten' : '') + '" role="group">' + Array.from({ length: to - from + 1 }, (_, i) => '<button type="button" data-' + name + '="' + (from + i) + '">' + (from + i) + '</button>').join('') + '</div>';
    sheet('<h2>' + esc(titulo) + '</h2>' +
      '<div class="seg" role="group" aria-label="Cómo ha ido"><button type="button" class="on" data-e="hecha">Hecha</button><button type="button" data-e="a medias">A medias</button><button type="button" data-e="no hecha">No la hice</button></div>' +
      '<div class="field" id="rpef"><span class="label">Esfuerzo de la sesión (1 = muy fácil, 10 = máximo)</span>' + scale('rpe', 1, 10) + '</div>' +
      '<div class="field" id="rodf"><span class="label">Molestias o dolor (0 = nada, 10 = mucho)</span>' + scale('rod', 0, 10) + '</div>' +
      '<label class="field"><span class="label">Nota (opcional)</span><textarea id="nota" placeholder="Cómo te has sentido, algo que molestó…"></textarea></label>' +
      '<button class="btn accent" type="button" id="save">Guardar</button>', p => {
      p.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { v.estado = b.dataset.e; p.querySelectorAll('[data-e]').forEach(x => x.classList.toggle('on', x === b)); p.querySelector('#rpef').hidden = p.querySelector('#rodf').hidden = v.estado === 'no hecha'; });
      p.querySelectorAll('[data-rpe]').forEach(b => b.onclick = () => { v.rpe = b.dataset.rpe; p.querySelectorAll('[data-rpe]').forEach(x => x.classList.toggle('on', x === b)); });
      p.querySelectorAll('[data-rod]').forEach(b => b.onclick = () => { v.dolor = b.dataset.rod; p.querySelectorAll('[data-rod]').forEach(x => x.classList.toggle('on', x === b)); });
      p.querySelector('#save').onclick = () => { closeSheet(); act('close', { id, estado: v.estado, rpe: v.rpe, dolor: v.dolor, nota: p.querySelector('#nota').value }, after); };
    });
  }

  // ------------------------------------------------------------------ calendario
  let weekOffset = 0;
  async function viewCal() {
    const wk = await read('week', { offset: weekOffset }, 'week' + weekOffset);
    const t = today();
    const label = weekOffset === 0 ? 'Esta semana' : weekOffset === 1 ? 'La semana que viene' : weekOffset === -1 ? 'La semana pasada' : 'Semana del ' + pdate(wk.monday).getDate();
    const days = Array.from({ length: 7 }, (_, i) => addDays(wk.monday, i));
    const missing = wk.sessions.filter(s => s.estado === 'sin hueco');
    let html = '<div class="head"><div><div class="over">Semana ' + wk.bloque.semana + ' del bloque ' + wk.bloque.bloque + (wk.bloque.semana === 4 ? ' · descarga' : '') + '</div><h1>Calendario</h1></div></div>' + banner() +
      '<div class="week-nav"><button class="iconbtn" type="button" id="prev" aria-label="Semana anterior">' + ICON.back + '</button><b>' + label + '</b><button class="iconbtn" type="button" id="next" aria-label="Semana siguiente" style="transform:scaleX(-1)">' + ICON.back + '</button></div>';
    if (missing.length) html += '<section class="card note"><div class="label" style="color:var(--warn)">No caben esta semana</div><div>' + missing.map(s => esc(s.titulo)).join(', ') + '</div>' + (weekOffset === 0 ? '<button class="btn small line" type="button" id="replan">Buscar hueco otra vez</button>' : '') + '</section>';
    html += '<section class="card tight">' + days.map(d => {
      const items = wk.events.filter(e => e.fecha === d).map(e => ({ h: e.todoElDia ? 'Todo el día' : e.inicio + '–' + e.fin, k: e.inicio || '00:00', html: '<div class="ev"><span class="h">' + esc(e.todoElDia ? 'Todo el día' : e.inicio + '–' + e.fin) + '</span><span>' + esc(e.titulo) + '</span></div>' }))
        .concat(wk.sessions.filter(s => s.fecha === d && s.estado !== 'sin hueco').map(s => ({ k: s.inicio, html: '<a class="ev s ' + TIPO_CLASS(s.tipo) + (s.estado === 'hecha' ? ' done' : s.estado === 'no hecha' ? ' miss' : '') + '" href="#/sesion/' + esc(s.id) + '"><span class="h">' + esc(s.inicio + '–' + s.fin) + '</span><span>' + esc(s.titulo) + (s.estado === 'reservar' ? ' · reservar' : s.estado === 'hecha' ? ' ✓' : '') + '</span></a>' })))
        .sort((a, b) => a.k.localeCompare(b.k));
      const dd = pdate(d);
      return '<div class="cal-day' + (d === t ? ' today' : '') + '"><div class="dn"><b>' + cap(DIAS[dd.getDay()]) + ' ' + dd.getDate() + '</b>' + (d === t ? '<span class="tag f">Hoy</span>' : '') + '</div>' + (items.length ? items.map(i => i.html).join('') : '<div class="muted small">Libre</div>') + '</div>';
    }).join('') + '</section><p class="muted small" style="text-align:center">Los entrenos solo van en huecos libres. Si pones estudio encima, el entrenador los recoloca solo.</p>';
    view.innerHTML = html;
    $('#prev').onclick = () => { weekOffset = Math.max(-8, weekOffset - 1); render(); };
    $('#next').onclick = () => { weekOffset = Math.min(1, weekOffset + 1); render(); };
    if ($('#replan')) $('#replan').onclick = () => act('plan_now', {}, r => { toast('He colocado ' + r.placed + ' sesión(es)' + (r.missing.length ? '; siguen sin caber ' + r.missing.length + '.' : '.')); render(); });
  }

  // ------------------------------------------------------------------ sesión
  const presc = e => {
    if (e.t === 'plio') return e.series + ' × ' + e.reps + ' · ' + e.contactos + ' ' + (/lanzamiento/.test(e.id) ? 'lanzamientos' : 'contactos');
    const reps = e.series + ' × ' + e.reps + (e.seg ? ' s' : '') + (e.lado ? ' por lado' : '');
    return reps + ' · RIR ' + e.rir + ' · descanso ' + mmss(e.descanso);
  };
  const exName = id => (window.EJERCICIOS[id] || { nombre: id.replace(/_/g, ' ') }).nombre;
  const fmtCite = c => esc(c.autores) + ' (' + esc(c.año) + ')';
  function citeButtons(cites) { return (cites || []).map(c => '<button type="button" class="cite" data-cite="' + esc(c.id) + '">' + esc(c.id) + ' · ' + fmtCite(c) + '</button>').join(''); }
  function bindCites(root, cites) {
    root.querySelectorAll('[data-cite]').forEach(b => b.onclick = () => { const c = (cites || []).find(x => x.id === b.dataset.cite) || {}; studySheet(c.id, c); });
  }
  async function studySheet(id, c) {
    let e = c;
    if (!e || !e.titulo) { try { const ev = await read('evidence'); e = ev.items.find(x => x.id === id) || c; } catch (err) { /* sin conexión: lo que haya */ } }
    sheet('<div class="label">Estudio ' + esc(id) + '</div><h3>' + esc(e.afirmacion) + '</h3><div class="ref">' + esc(e.autores) + ' (' + esc(e.año) + '). ' + (e.titulo ? '<i>' + esc(e.titulo) + '</i>. ' : '') + esc(e.revista || '') + '</div>' +
      (e.tipo ? '<div class="btns"><span class="tag">' + esc(e.tipo) + '</span><span class="tag ' + (e.solidez === 'alta' ? 'c' : 'w') + '">Solidez ' + esc(e.solidez) + '</span></div>' : '') +
      (e.doi ? '<a class="btn soft" href="https://doi.org/' + esc(e.doi) + '" target="_blank" rel="noopener">Abrir el estudio (DOI)</a>' : '') + '<button class="btn line" type="button" data-close>Cerrar</button>', p => { p.querySelector('[data-close]').onclick = closeSheet; });
  }

  async function viewSession(id) {
    const s = await read('session', { id }, 'session.' + id);
    const open = s.estado === 'planificada' || s.estado === 'reservar';
    let html = '<div class="topbar">' + back('#/inicio', 'Inicio') + '</div>' + banner() +
      '<div class="head" style="padding-top:0"><div><div class="over">' + esc(s.fecha ? cap(longDay(s.fecha)) + ' · ' + s.inicio + '–' + s.fin : 'Sin hueco esta semana') + '</div><h1>' + esc(s.titulo) + '</h1></div></div>' +
      '<div class="btns"><span class="tag ' + TIPO_CLASS(s.tipo) + '">' + esc(cap(s.tipo === 'natacion' ? 'natación' : s.tipo)) + '</span><span class="tag">' + esc(LUGAR[s.version] || LUGAR[s.lugar] || s.lugar) + '</span>' + (s.minutos ? '<span class="tag">' + esc(s.minutos) + ' min</span>' : '') + (s.prioridad === 'clave' ? '<span class="tag f">Clave</span>' : '') +
      (s.estado !== 'planificada' ? '<span class="tag w">' + esc(cap(s.estado)) + '</span>' : '') + '</div>';
    if (s.ejercicios) {
      html += '<section class="card tight">' + s.ejercicios.map(e => {
        const ex = window.EJERCICIOS[e.id];
        return '<a class="ex-row" href="#/ej/' + esc(e.id) + '"><div class="mini">' + (ex ? window.figureSvg(ex, 1, 50) : '') + '</div><div class="grow" style="flex:1;min-width:0"><div class="t" style="font-weight:600">' + esc(exName(e.id)) + '</div><div class="s muted small">' + esc(presc(e)) + '</div>' +
          (e.sugerido && e.sugerido.kg ? '<div class="small" style="color:var(--accent);font-weight:600">' + esc(e.sugerido.kg) + ' kg</div>' : '') + '</div>' + ICON.chev + '</a>';
      }).join('') + '</section>';
    } else if (s.texto) html += '<section class="card"><p style="margin:0">' + esc(s.texto) + '</p></section>';
    html += '<section class="card"><div class="label">¿Por qué esta sesión?</div><p style="margin:0">' + esc(s.porque.texto) + '</p><div class="btns">' + citeButtons(s.porque.cites) + '</div></section>';
    if (open) {
      html += '<div class="btns">' + (s.ejercicios ? '<a class="btn accent grow" href="#/gym/' + esc(s.id) + '">Empezar modo gimnasio</a>' : '<button class="btn accent grow" type="button" id="done">La he hecho</button>') + '</div>' +
        '<div class="btns"><button class="btn line grow" type="button" id="move">Mover</button><button class="btn line grow" type="button" id="cant">No puedo</button>' + (s.clave === 'BI' ? '<button class="btn line grow" type="button" id="swap">Cambiar por carrera</button>' : '') + '</div>' +
        (s.ejercicios ? '<button class="linkbtn" type="button" id="done">Ya la he hecho (cerrar sin apuntar series)</button>' : '');
    } else if (s.estado === 'hecha' || s.estado === 'a medias') {
      const c = s.cierre || {};
      html += '<section class="card"><div class="label">Cierre</div><div>' + (c.rpe ? 'Esfuerzo ' + esc(c.rpe) + '/10' : 'Sin esfuerzo apuntado') + (c.dolor !== '' && c.dolor != null ? ' · molestias ' + esc(c.dolor) + '/10' : '') + '</div>' + (c.nota ? '<div class="muted">' + esc(c.nota) + '</div>' : '') + '</section>';
    }
    view.innerHTML = html;
    bindCites(view, s.porque.cites);
    const on = (sel, fn) => { const el = view.querySelector(sel); if (el) el.onclick = fn; };
    on('#done', () => closeFlow(s.id, s.titulo, () => { location.hash = '#/inicio'; }));
    on('#cant', () => act('cant', { id: s.id }, () => { location.hash = '#/inicio'; }));
    on('#swap', () => act('swap_run', { id: s.id }, () => { location.hash = '#/calendario'; }));
    on('#move', () => moveFlow(s));
  }

  function moveFlow(s) {
    const monday = mondayOf(s.fecha || today());
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter(d => d >= today());
    sheet('<h2>Mover ' + esc(s.titulo) + '</h2><label class="field"><span class="label">Día</span><select id="d">' + days.map(d => '<option value="' + d + '"' + (d === s.fecha ? ' selected' : '') + '>' + esc(cap(longDay(d))) + '</option>').join('') + '</select></label>' +
      '<label class="field"><span class="label">Hora (vacío = la busco yo en un hueco libre)</span><input id="h" type="time" step="900"></label>' +
      '<p class="muted small">Respeto el estudio y las reglas (nada de pierna pesada antes de la tirada larga).</p><button class="btn accent" type="button" id="ok">Mover</button>', p => {
      p.querySelector('#ok').onclick = () => { closeSheet(); act('move', { id: s.id, date: p.querySelector('#d').value, time: p.querySelector('#h').value }, () => { location.hash = '#/calendario'; }); };
    });
  }

  // ------------------------------------------------------------------ modo gimnasio
  async function viewGym(id) {
    const s = await read('session', { id }, 'session.' + id);
    if (!s.ejercicios) { location.hash = '#/sesion/' + id; return; }
    const G = LS.get('gym.' + id, null) || { i: 0, started: Date.now(), sets: {}, restEnd: 0 };
    s.ejercicios.forEach(e => {
      if (!G.sets[e.id]) G.sets[e.id] = Array.from({ length: e.series }, (_, k) => { const h = (e.hechas || []).find(x => Number(x.serie) === k + 1); return h ? { kg: h.kg, reps: h.reps, rir: h.rir, done: true } : { kg: '', reps: '', rir: '', done: false }; });
    });
    const save = () => LS.set('gym.' + id, G);
    const n = s.ejercicios.length;

    function draw() {
      const e = s.ejercicios[G.i], ex = window.EJERCICIOS[e.id] || { nombre: e.id, musculos: { primarios: [], secundarios: [] }, pose: 'stand' };
      const strength = e.t === 'fuerza';
      const repLabel = e.t === 'plio' ? (/lanzamiento/.test(e.id) ? 'Lanz.' : 'Contactos') : e.seg ? 'Seg' : 'Reps';
      const sets = G.sets[e.id];
      const mus = ex.musculos.primarios.map(m => '<span><i style="background:#B83A0B"></i>' + esc(m.nombre) + '</span>').concat(ex.musculos.secundarios.map(m => '<span><i style="background:#F0A47F"></i>' + esc(m.nombre) + '</span>')).join('');
      const grid = strength ? '36px repeat(3, minmax(0, 1fr)) 44px' : '36px minmax(0, 1fr) 44px';
      view.innerHTML = '<div class="topbar">' + back('#/sesion/' + esc(id), s.titulo.split(' · ')[0]) + '<div style="display:flex;gap:10px;align-items:center"><span class="small muted" style="font-weight:600">' + (G.i + 1) + ' de ' + n + '</span><b id="clock">0:00</b></div></div>' +
        '<div class="progress-dots" aria-hidden="true">' + s.ejercicios.map((x, k) => '<i class="' + (k <= G.i ? 'on' : '') + '"></i>').join('') + '</div>' +
        '<section class="card" style="padding:14px 16px 16px"><div class="figs"><div class="fig">' + window.figureSvg(ex, 0, 140) + '<div class="label">Inicio</div></div><div class="fig">' + window.figureSvg(ex, 1, 140) + '<div class="label">Final</div></div></div>' +
        '<div class="mus">' + mus + '</div>' +
        '<div class="topbar" style="align-items:flex-end"><div><h2>' + esc(ex.nombre) + '</h2><div class="small" style="color:var(--ink2)">' + esc(presc(e)) + '</div></div><div class="btns" style="flex-wrap:nowrap"><button class="linkbtn" type="button" id="ficha">Ficha</button><button class="linkbtn" type="button" id="why">¿Por qué?</button></div></div>' +
        (e.nota ? '<div class="small muted">' + esc(cap(e.nota)) + '</div>' : '') + '</section>' +
        '<section class="card" style="padding:4px 16px;gap:0"><div class="sets-head label" style="grid-template-columns:' + grid + '"><span>Serie</span>' + (strength ? '<span>Kg</span><span>' + repLabel + '</span><span>RIR</span>' : '<span>' + repLabel + (e.lado ? ' por lado' : '') + '</span>') + '<span></span></div>' +
        sets.map((x, k) => '<div class="set" style="grid-template-columns:' + grid + '"><b>' + (k + 1) + '</b>' +
          (strength ? '<input inputmode="decimal" aria-label="Kilos serie ' + (k + 1) + '" data-k="' + k + '" data-f="kg" value="' + esc(x.kg) + '" placeholder="' + esc(e.sugerido && e.sugerido.kg || '') + '">' : '') +
          '<input inputmode="numeric" aria-label="' + repLabel + ' serie ' + (k + 1) + '" data-k="' + k + '" data-f="reps" value="' + esc(x.reps) + '" placeholder="' + esc(e.reps) + '">' +
          (strength ? '<input inputmode="numeric" aria-label="Repeticiones en reserva serie ' + (k + 1) + '" data-k="' + k + '" data-f="rir" value="' + esc(x.rir) + '" placeholder="' + esc(e.rir) + '">' : '') +
          '<button type="button" class="check' + (x.done ? ' on' : '') + '" data-done="' + k + '" aria-label="Marcar serie ' + (k + 1) + '" aria-pressed="' + x.done + '">' + ICON.check + '</button></div>').join('') +
        '<div class="small muted" style="padding:8px 0 12px">' + esc(e.sugerido ? e.sugerido.texto : strength ? '' : e.t === 'plio' ? 'Calidad antes que cantidad: para si los saltos dejan de ser rápidos.' : 'Controla el movimiento, sin prisa.') + '</div></section>' +
        '<section class="rest"><div><div class="label">Descanso</div><div class="big" id="rest">' + mmss(e.descanso) + '</div></div><div class="btns" style="flex-wrap:nowrap"><button class="btn ghost small" type="button" id="plus">+15 s</button><button class="btn white small" type="button" id="skip">Saltar</button></div></section>' +
        '<div class="btns">' + (G.i > 0 ? '<button class="btn line" type="button" id="prev">Anterior</button>' : '') + '<button class="btn grow" type="button" id="nextx" style="font-size:15px">' + (G.i < n - 1 ? 'Siguiente: ' + esc(exName(s.ejercicios[G.i + 1].id)) : 'Terminar sesión') + '</button></div>';

      view.querySelectorAll('input[data-k]').forEach(inp => inp.oninput = () => { sets[inp.dataset.k][inp.dataset.f] = inp.value; save(); });
      view.querySelectorAll('[data-done]').forEach(b => b.onclick = () => {
        const k = Number(b.dataset.done), x = sets[k];
        x.done = !x.done;
        if (x.done) {
          // lo que no escribes se toma de lo propuesto
          if (strength && x.kg === '' && e.sugerido && e.sugerido.kg) x.kg = e.sugerido.kg;
          if (x.reps === '') x.reps = e.reps;
          if (strength && x.rir === '') x.rir = e.rir;
          sendSet({ sesion: id, ejercicio: e.id, serie: k + 1, kg: strength ? x.kg : '', reps: x.reps, rir: strength ? x.rir : '' });
          G.restEnd = Date.now() + e.descanso * 1000;
        }
        save(); draw();
      });
      $('#plus').onclick = () => { G.restEnd = Math.max(G.restEnd, Date.now()) + 15000; save(); tick(); };
      $('#skip').onclick = () => { G.restEnd = 0; save(); tick(); };
      $('#ficha').onclick = () => exerciseSheet(e.id);
      $('#why').onclick = () => sheet('<div class="label">¿Por qué ' + esc(ex.nombre.toLowerCase()) + '?</div><p>' + esc(ex.para || '') + '</p><div class="label">Y la sesión</div><p>' + esc(s.porque.texto) + '</p><div class="btns">' + citeButtons(s.porque.cites) + '</div>', p => bindCites(p, s.porque.cites));
      if ($('#prev')) $('#prev').onclick = () => { G.i--; G.restEnd = 0; save(); draw(); window.scrollTo(0, 0); };
      $('#nextx').onclick = () => {
        if (G.i < n - 1) { G.i++; G.restEnd = 0; save(); draw(); window.scrollTo(0, 0); return; }
        const any = s.ejercicios.some(x => G.sets[x.id].some(y => y.done));
        closeFlow(id, s.titulo, () => { LS.del('gym.' + id); location.hash = '#/inicio'; });
        if (!any) toast('No has marcado ninguna serie: puedes cerrarla igual.');
      };
      tick();
    }
    let buzzed = false;
    function tick() {
      const c = $('#clock'), r = $('#rest');
      if (!c || !r) return;
      c.textContent = mmss(Math.floor((Date.now() - G.started) / 1000));
      const e = s.ejercicios[G.i];
      const left = Math.ceil((G.restEnd - Date.now()) / 1000);
      if (left > 0) { r.textContent = mmss(left); buzzed = false; }
      else {
        r.textContent = G.restEnd ? '¡Vamos!' : mmss(e.descanso);
        if (G.restEnd && !buzzed) { buzzed = true; try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (err) { /* sin vibración */ } }
      }
    }
    draw();
    timers.push(setInterval(tick, 1000));
  }

  // ------------------------------------------------------------------ chat con el entrenador
  let chatCache = null;
  async function viewChat() {
    if (!chatCache) chatCache = (await read('chat_history')).messages;
    const st = LS.get('cache.state', null);
    const todaySession = st && st.data.today.find(s => s.estado === 'planificada' || s.estado === 'reservar');
    view.innerHTML = '<div class="head"><div><div class="over">Responde con estudios verificados o te dice que es criterio propio</div><h1>Entrenador</h1></div></div>' + banner() +
      '<div class="chat" id="msgs">' + (chatCache.length ? '' : '<div class="msg entrenador">¡Hola! Cuéntame qué tal vas, si esta semana tienes poco tiempo o pregúntame el porqué de cualquier ejercicio.</div>') + chatCache.map(msgHtml).join('') + '</div>' +
      '<div class="chips" style="margin-top:6px">' + (todaySession ? '<button class="chip" type="button" id="qcant">Hoy no puedo</button>' : '') + '<button class="chip" type="button" data-q="Esta semana voy justo de tiempo">Voy justo de tiempo</button><button class="chip" type="button" data-q="¿Por qué hago la sesión de hoy así?">¿Por qué la sesión de hoy?</button><button class="chip" type="button" data-q="Hoy tengo una molestia, ¿qué hago?">Tengo una molestia</button></div>' +
      '<div style="height:70px"></div><div class="composer"><form id="cf"><label class="sr" for="ct">Mensaje</label><textarea id="ct" rows="1" placeholder="Escribe al entrenador…"></textarea><button type="submit" aria-label="Enviar">' + ICON.send + '</button></form></div>';
    chatCache.forEach((m, i) => { const el = $('#msgs').children[i]; if (el) bindCites(el, m.cites); });
    window.scrollTo(0, document.body.scrollHeight);
    const ta = $('#ct');
    ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
    ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer:fine)').matches) { e.preventDefault(); $('#cf').requestSubmit(); } };
    $('#cf').onsubmit = e => { e.preventDefault(); const t = ta.value.trim(); if (t) { ta.value = ''; ta.style.height = 'auto'; send(t); } };
    view.querySelectorAll('[data-q]').forEach(b => b.onclick = () => send(b.dataset.q));
    // "Hoy no puedo" no espera a la IA: va directo al código
    if ($('#qcant')) $('#qcant').onclick = async () => {
      push({ rol: 'yo', texto: 'Hoy no puedo entrenar' });
      try { const r = await api('cant', { id: todaySession.id }); LS.del('cache.state'); push({ rol: 'entrenador', texto: r.msg, undo: r.undo }); }
      catch (err) { push({ rol: 'entrenador', texto: '⚠️ ' + err.message }); }
    };
  }
  function msgHtml(m) {
    return '<div class="msg ' + (m.rol === 'yo' ? 'yo' : 'entrenador') + '">' + esc(m.texto) + (m.cites && m.cites.length ? '<div class="cites">' + citeButtons(m.cites) + '</div>' : '') +
      (m.undo ? '<div class="cites"><button class="cite" type="button" data-undo="' + esc(m.undo) + '">Deshacer</button></div>' : '') + '</div>';
  }
  function push(m) {
    chatCache.push(m);
    const box = $('#msgs');
    if (!box) return;
    box.insertAdjacentHTML('beforeend', msgHtml(m));
    const el = box.lastElementChild;
    bindCites(el, m.cites);
    const u = el.querySelector('[data-undo]');
    if (u) u.onclick = async () => { u.disabled = true; try { const r = await api('undo', { undo: m.undo }); toast(r.msg); } catch (err) { toast('⚠️ ' + err.message); } };
    window.scrollTo(0, document.body.scrollHeight);
  }
  async function send(text) {
    push({ rol: 'yo', texto: text });
    const box = $('#msgs');
    box.insertAdjacentHTML('beforeend', '<div class="typing" id="typing">El entrenador está escribiendo…</div>');
    window.scrollTo(0, document.body.scrollHeight);
    try {
      const r = await api('chat', { text });
      const t = $('#typing'); if (t) t.remove();
      LS.del('cache.state');
      push({ rol: 'entrenador', texto: r.reply, cites: r.cites, undo: r.undo });
    } catch (err) {
      const t = $('#typing'); if (t) t.remove();
      push({ rol: 'entrenador', texto: '⚠️ No he podido contestar: ' + err.message + ' Los botones (hoy no puedo, mover, cerrar) funcionan igual sin IA.' });
    }
  }

  // ------------------------------------------------------------------ bibliotecas
  let biblioTab = 'ej', biblioGroup = 'Todos', biblioQ = '';
  async function viewBiblio() {
    let html = '<div class="head"><h1>Bibliotecas</h1></div><div class="seg" role="tablist"><button type="button" data-bt="ej" class="' + (biblioTab === 'ej' ? 'on' : '') + '">Ejercicios</button><button type="button" data-bt="es" class="' + (biblioTab === 'es' ? 'on' : '') + '">Estudios</button></div>';
    if (biblioTab === 'ej') {
      const all = Object.values(window.EJERCICIOS);
      const groups = ['Todos', 'En casa'].concat(Array.from(new Set(all.map(e => e.grupo))));
      const q = biblioQ.toLowerCase();
      const list = all.filter(e => (biblioGroup === 'Todos' || (biblioGroup === 'En casa' ? e.lugar.indexOf('casa') >= 0 : e.grupo === biblioGroup)) &&
        (!q || (e.nombre + ' ' + e.para + ' ' + e.musculos.primarios.concat(e.musculos.secundarios).map(m => m.nombre).join(' ') + ' ' + e.deportes.join(' ')).toLowerCase().indexOf(q) >= 0));
      html += '<input class="search" type="search" id="q" placeholder="Busca por nombre, músculo o deporte" value="' + esc(biblioQ) + '" aria-label="Buscar ejercicio">' +
        '<div class="chips">' + groups.map(g => '<button type="button" class="chip' + (g === biblioGroup ? ' on' : '') + '" data-g="' + esc(g) + '">' + esc(g) + '</button>').join('') + '</div>' +
        (list.length ? '<div class="grid">' + list.map(e => '<a class="tile" href="#/ej/' + esc(e.id) + '"><div class="pic">' + window.figureSvg(e, 1, 110) + '</div><div class="t">' + esc(e.nombre) + '</div><div class="small muted">' + esc(e.musculos.primarios.map(m => m.nombre).join(', ')) + '</div></a>').join('') + '</div>' : '<div class="empty">No hay ejercicios con eso.</div>') +
        '<p class="muted small" style="text-align:center">Dibujos propios: músculo principal en naranja oscuro, secundario en claro. Ninguno viene todavía de tus reels.</p>';
      view.innerHTML = html;
      const qi = $('#q');
      qi.oninput = () => { biblioQ = qi.value; const pos = qi.selectionStart; viewBiblio().then(() => { const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); }); };
      view.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { biblioGroup = b.dataset.g; viewBiblio(); });
    } else {
      const ev = await read('evidence');
      const temas = Array.from(new Set(ev.items.map(e => e.tema)));
      const list = ev.items.filter(e => biblioGroup === 'Todos' || e.tema === biblioGroup || temas.indexOf(biblioGroup) < 0);
      html += banner() + '<div class="card note small">Solo se citan estudios comprobados: el DOI existe en Crossref y el título coincide. Lo que no tenga estudio detrás, el entrenador te lo dice como criterio propio.</div>' +
        '<div class="chips">' + ['Todos'].concat(temas).map(g => '<button type="button" class="chip' + (g === biblioGroup || (g === 'Todos' && temas.indexOf(biblioGroup) < 0) ? ' on' : '') + '" data-g="' + esc(g) + '">' + esc(cap(String(g).replace(/_/g, ' '))) + '</button>').join('') + '</div>' +
        '<section class="card tight">' + list.map(e => '<div class="study"><div class="btns"><span class="tag f">' + esc(e.id) + '</span><span class="tag">' + esc(e.tipo) + '</span><span class="tag ' + (e.solidez === 'alta' ? 'c' : 'w') + '">Solidez ' + esc(e.solidez) + '</span>' + (e.estado !== 'verificado' ? '<span class="tag w">' + esc(e.estado) + '</span>' : '') + '</div>' +
          '<div class="claim">' + esc(e.afirmacion) + '</div><div class="ref">' + esc(e.autores) + ' (' + esc(e.año) + '). <i>' + esc(e.titulo) + '</i>. ' + esc(e.revista) + '</div>' +
          (e.doi ? '<a class="small" style="font-weight:700" href="https://doi.org/' + esc(e.doi) + '" target="_blank" rel="noopener">doi.org/' + esc(e.doi) + '</a>' : '') + '</div>').join('') + '</section>';
      view.innerHTML = html;
      view.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { biblioGroup = b.dataset.g; viewBiblio(); });
    }
    view.querySelectorAll('[data-bt]').forEach(b => b.onclick = () => { biblioTab = b.dataset.bt; biblioGroup = 'Todos'; viewBiblio(); });
  }

  function exerciseHtml(e) {
    const mus = e.musculos.primarios.map(m => '<span><i style="background:#B83A0B"></i>' + esc(m.nombre) + '</span>').concat(e.musculos.secundarios.map(m => '<span><i style="background:#F0A47F"></i>' + esc(m.nombre) + '</span>')).join('');
    const li = xs => '<ul class="steps">' + xs.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    return '<section class="card"><div class="figs"><div class="fig">' + window.figureSvg(e, 0, 140) + '<div class="label">Inicio</div></div><div class="fig">' + window.figureSvg(e, 1, 140) + '<div class="label">Final</div></div></div><div class="mus">' + mus + '</div></section>' +
      '<section class="card"><div class="label">Para qué</div><p style="margin:0">' + esc(e.para) + '</p><div class="btns">' + e.deportes.map(d => '<span class="tag">' + esc(d) + '</span>').join('') + '</div></section>' +
      (e.maquina ? '<section class="card"><div class="label">Cómo es la máquina</div><p style="margin:0">' + esc(e.maquina) + '</p></section>' : '') +
      '<section class="card"><div class="label">Cómo se hace</div><ol class="steps">' + e.pasos.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol></section>' +
      '<section class="card"><div class="label">Claves</div>' + li(e.claves) + '<div class="label">Errores típicos</div>' + li(e.errores) + '</section>' +
      '<section class="card tight"><div class="row"><div class="grow"><div class="s">Más difícil</div><div class="t">' + esc(e.progresion) + '</div></div></div><div class="row"><div class="grow"><div class="s">Más fácil</div><div class="t">' + esc(e.regresion) + '</div></div></div><div class="row"><div class="grow"><div class="s">Si no tienes el material</div><div class="t">' + esc(e.alternativa) + '</div></div></div></section>' +
      '<p class="muted small">Material: ' + esc(e.material) + ' · ' + esc(e.lugar.map(l => LUGAR[l]).join(', ')) + '<br>' + esc(e.fuente) + '</p>';
  }
  function viewExercise(id) {
    const e = window.EJERCICIOS[id];
    if (!e) { view.innerHTML = '<div class="empty">No encuentro ese ejercicio.</div>'; return; }
    view.innerHTML = '<div class="topbar"><a class="back" href="javascript:history.back()">' + ICON.back + 'Volver</a></div><div class="head" style="padding-top:0"><div><div class="over">' + esc(e.grupo) + '</div><h1>' + esc(e.nombre) + '</h1></div></div>' + exerciseHtml(e);
  }
  function exerciseSheet(id) {
    const e = window.EJERCICIOS[id];
    if (e) sheet('<h2>' + esc(e.nombre) + '</h2>' + exerciseHtml(e).replace(/class="card/g, 'style="background:var(--bg)" class="card'));
  }

  // ------------------------------------------------------------------ perfil: gustos, reloj y sus datos
  const PERFIL_SUGERIDO = [['gustos', 'Qué te gusta entrenar y qué no'], ['deportes', 'Deportes que haces'], ['lesiones', 'Molestias o lesiones a tener en cuenta'],
    ['horario_preferido', 'Cuándo prefieres entrenar'], ['casa', 'Material que tienes en casa'], ['gimnasio', 'Horario y distancia del gimnasio'], ['reloj', 'Modelo de reloj']];
  const labelOf = k => { const s = PERFIL_SUGERIDO.find(x => x[0] === k); return s ? cap(s[0].replace(/_/g, ' ')) : cap(k.replace(/^pref_.*/, 'preferencia').replace(/_/g, ' ')); };
  async function viewProfile() {
    const pr = await read('profile');
    const items = pr.perfil.slice();
    PERFIL_SUGERIDO.forEach(([k]) => { if (!items.some(i => i.clave === k)) items.push({ clave: k, valor: '' }); });
    const nombre = (items.find(i => i.clave === 'nombre') || {}).valor;
    let html = '<div class="topbar">' + back('#/inicio', 'Inicio') + '<a class="iconbtn" href="#/ajustes" aria-label="Conexión con la agenda">' + ICON.gear + '</a></div>' +
      '<div class="head" style="padding-top:0"><div><div class="over">Lo que el entrenador sabe de ti</div><h1>' + esc(nombre || 'Perfil') + '</h1></div></div>' + banner() +
      '<section class="card"><div class="label">Sobre ti</div>' +
      items.filter(i => i.clave !== 'nombre').map(i => '<label class="field"><span class="small" style="font-weight:600">' + esc(labelOf(i.clave)) + '</span><textarea data-pk="' + esc(i.clave) + '" rows="2" placeholder="' + esc((PERFIL_SUGERIDO.find(x => x[0] === i.clave) || [0, ''])[1]) + '">' + esc(i.valor) + '</textarea></label>').join('') +
      '<div class="btns"><button class="btn accent grow" type="button" id="savep">Guardar</button><button class="btn line" type="button" id="addp">Añadir dato</button></div>' +
      '<p class="muted small" style="margin:0">Deja un campo vacío para borrarlo. También puedes decírselo al entrenador en el chat.</p></section>';
    html += '<section class="card"><div class="topbar"><h3>Reloj</h3>' + (pr.reloj.conectado ? '<span class="tag c">Conectado</span>' : '<span class="tag">Sin conectar</span>') + '</div>';
    if (pr.reloj.conectado) {
      html += '<p class="muted small" style="margin:0">Vía intervals.icu (atleta ' + esc(pr.reloj.atleta) + '). Las actividades se importan solas cada 30 min.</p><div class="btns"><button class="btn small line" type="button" id="disc">Desconectar</button></div></section>' +
        '<div id="watch"><div class="spin" aria-label="Cargando datos del reloj"></div></div>';
    } else {
      html += '<p style="margin:0">Strava no deja que otras apps lean tus datos, así que el reloj se conecta a través de <b>intervals.icu</b> (gratis):</p>' +
        '<ol class="steps small"><li>Crea la cuenta en intervals.icu y en Settings → Connections conecta <b>Garmin</b> (no Strava: sus actividades no se pueden leer).</li><li>En Settings, abajo del todo, en Developer Settings: copia tu <b>Athlete ID</b> y genera una <b>API Key</b>.</li></ol>' +
        '<label class="field"><span class="label">Athlete ID</span><input id="wa" placeholder="i123456" autocomplete="off"></label>' +
        '<label class="field"><span class="label">API Key</span><input id="wk" autocomplete="off"></label>' +
        '<button class="btn accent" type="button" id="conn">Conectar reloj</button></section>';
    }
    view.innerHTML = html;
    const collect = () => Array.from(view.querySelectorAll('[data-pk]')).map(t => ({ clave: t.dataset.pk, valor: t.value.trim() }));
    $('#savep').onclick = () => { const all = collect(); act('save_profile', { items: all.filter(x => x.valor), borrar: all.filter(x => !x.valor).map(x => x.clave) }, () => { LS.del('cache.profile'); }); };
    $('#addp').onclick = () => sheet('<h2>Añadir dato</h2><label class="field"><span class="label">Qué es</span><input id="k" placeholder="Por ejemplo: sueño, trabajo, alimentación"></label><label class="field"><span class="label">Detalle</span><textarea id="v"></textarea></label><button class="btn accent" type="button" id="ok">Añadir</button>', p => {
      p.querySelector('#ok').onclick = () => { const k = p.querySelector('#k').value.trim(), v = p.querySelector('#v').value.trim(); if (!k || !v) return; closeSheet(); act('save_profile', { items: [{ clave: k, valor: v }], borrar: [] }); };
    });
    if ($('#conn')) $('#conn').onclick = () => act('connect_watch', { atleta: $('#wa').value, clave: $('#wk').value });
    if ($('#disc')) $('#disc').onclick = () => act('connect_watch', { atleta: '', clave: '' });
    if (pr.reloj.conectado) {
      try { renderWatch(await read('watch')); }
      catch (e) { const w = $('#watch'); if (w) w.innerHTML = '<div class="card note small">No he podido leer el reloj: ' + esc(e.message) + '</div>'; }
    }
  }

  function renderWatch(w) {
    const box = $('#watch');
    if (!box) return;
    const lastV = l => l && l.length ? l[l.length - 1].valor : null;
    const dm = f => pdate(f).getDate() + '/' + (pdate(f).getMonth() + 1);
    const z = w.zonas || [], tot = z.reduce((a, b) => a + b, 0), low = tot ? Math.round(100 * ((z[0] || 0) + (z[1] || 0)) / tot) : null;
    const tile = (label, v, unit) => '<div class="stat"><span class="label">' + label + '</span><b>' + (v == null ? '–' : esc(String(v).replace('.', ','))) + '</b><span class="small muted">' + unit + '</span></div>';
    let html = '<div class="stats">' + tile('VO2max', lastV(w.vo2max), 'ml/kg/min') + tile('FC reposo', lastV(w.reposo), 'ppm') + tile('FC entrenando', w.fcEntreno, 'ppm · 4 sem.') + '</div>';
    if (w.forma || w.sueno) html += '<div class="stats" style="margin-top:10px">' + tile('Forma', w.forma ? w.forma.ctl : null, 'carga crónica') + tile('Fatiga', w.forma ? w.forma.atl : null, 'carga aguda') + tile('Sueño', w.sueno, 'horas anoche') + '</div>';
    if (tot) {
      html += '<section class="card" style="margin-top:14px"><div><h3>Zonas de pulso</h3><div class="small muted">Últimas 4 semanas · ' + Math.round(tot / 6) / 10 + ' h con pulso</div></div>' +
        z.map((m, i) => { const pct = Math.round(100 * m / tot); return '<div style="display:grid;grid-template-columns:30px 1fr 112px;gap:8px;align-items:center"><b class="small">Z' + (i + 1) + '</b><div style="background:var(--bg);border-radius:4px;height:14px"><div style="width:' + Math.max(pct ? 2 : 0, pct) + '%;height:14px;border-radius:4px;background:var(--accent)"></div></div><span class="small" style="text-align:right;font-variant-numeric:tabular-nums">' + pct + ' % · ' + m + ' min</span></div>'; }).join('') +
        '<p class="small" style="margin:0">' + (low >= 75 ? 'Un ' + low + ' % en zonas 1 y 2: bien repartido.' : 'Solo un ' + low + ' % en zonas 1 y 2: haces mucho a intensidad media o alta.') + ' En resistencia, lo habitual es que la mayor parte vaya a intensidad baja.</p><div class="btns"><button class="cite" type="button" id="e15">E15 · Seiler (2010)</button></div></section>';
    }
    if ((w.vo2max || []).length > 1) html += '<section class="card" style="margin-top:14px"><div><h3>VO2max estimado</h3><div class="small muted">Lo calcula el reloj; tómalo como tendencia, no como dato de laboratorio</div></div>' + lineChart(w.vo2max.map(p => ({ label: dm(p.fecha), value: p.valor })), 'ml/kg/min') + '</section>';
    if ((w.reposo || []).length > 1) html += '<section class="card" style="margin-top:14px"><div><h3>Pulso en reposo</h3><div class="small muted">Si sube varios días seguidos puede ser cansancio acumulado o que te estás poniendo malo</div></div>' + lineChart(w.reposo.map(p => ({ label: dm(p.fecha), value: p.valor })), 'ppm') + '</section>';
    const wk = (w.semanas || []).filter(x => x.fc);
    if (wk.length > 1) html += '<section class="card" style="margin-top:14px"><div><h3>Pulso medio entrenando</h3><div class="small muted">Media de cada semana, ponderada por la duración de cada actividad</div></div>' + barChart(w.semanas.map(x => ({ label: dm(x.semana), value: x.fc || 0, tip: x.fc ? x.fc + ' ppm · ' + String(x.horas).replace('.', ',') + ' h' : 'Sin datos' })), 'ppm') + '</section>';
    if (w.ocultas) html += '<div class="card note small" style="margin-top:14px">' + w.ocultas + ' actividad(es) vienen de Strava y intervals.icu no puede compartirlas. Conecta Garmin directamente en intervals.icu para verlas aquí.</div>';
    if (!w.actividades && !(w.vo2max || []).length) html += '<div class="card note small" style="margin-top:14px">Aún no llegan datos. Comprueba que Garmin está conectado en intervals.icu y que el reloj ha sincronizado.</div>';
    html += '<p class="muted small" style="text-align:center">Actualizado hace ' + ago(w.actualizado) + ' · <button class="linkbtn" type="button" id="wref">Actualizar</button></p>';
    box.innerHTML = html;
    bindCharts(box);
    if ($('#e15')) $('#e15').onclick = () => studySheet('E15');
    $('#wref').onclick = async () => { box.style.opacity = 0.5; try { renderWatch(await api('watch', { fresh: true })); } catch (e) { toast('⚠️ ' + e.message); } box.style.opacity = 1; };
  }

  // ------------------------------------------------------------------ progreso
  let strengthEx = null;
  async function viewProgress() {
    const [stt, st] = await Promise.all([read('stats'), read('state')]);
    const weeks = stt.weeks;
    const last4 = weeks.slice(-5, -1);
    const pct = last4.reduce((a, w) => a + w.planificadas, 0) ? Math.round(100 * last4.reduce((a, w) => a + w.hechas, 0) / last4.reduce((a, w) => a + w.planificadas, 0)) : 0;
    const peso = (stt.measures.peso || []).slice(-1)[0];
    const sKeys = Object.keys(stt.strength);
    if (!strengthEx || sKeys.indexOf(strengthEx) < 0) strengthEx = sKeys[0];
    const wl = w => pdate(w.semana).getDate() + '/' + (pdate(w.semana).getMonth() + 1);
    let html = '<div class="head"><h1>Progreso</h1></div>' + banner() +
      '<div class="stats"><div class="stat"><span class="label">Racha</span><b>' + esc(stt.streak) + '</b><span class="small muted">semanas</span></div>' +
      '<div class="stat"><span class="label">Cumplido</span><b>' + pct + ' %</b><span class="small muted">últimas 4 sem.</span></div>' +
      '<div class="stat"><span class="label">Peso</span><b>' + (peso ? esc(String(peso.valor).replace('.', ',')) : '–') + '</b><span class="small muted">kg</span></div></div>' +
      '<section class="card"><div><h3>Sesiones hechas por semana</h3><div class="small muted">Últimas 12 semanas</div></div>' + barChart(weeks.map(w => ({ label: wl(w), value: w.hechas, tip: w.hechas + ' de ' + w.planificadas + ' sesiones' })), 'sesiones') + '</section>' +
      '<section class="card"><div><h3>Carga semanal</h3><div class="small muted">Esfuerzo × minutos de cada sesión (método de Foster, [E11])</div></div>' + barChart(weeks.map(w => ({ label: wl(w), value: w.carga, tip: w.carga + ' u.a.' })), 'u.a.') + '</section>' +
      '<section class="card"><div><h3>Kilómetros de carrera</h3><div class="small muted">Del reloj, vía intervals.icu</div></div>' + barChart(weeks.map(w => ({ label: wl(w), value: w.km_carrera, tip: String(w.km_carrera).replace('.', ',') + ' km' })), 'km') + '</section>';
    if (sKeys.length) {
      const pts = stt.strength[strengthEx];
      html += '<section class="card"><div><h3>Fuerza estimada</h3><div class="small muted">1RM estimado con la fórmula de Epley a partir de tu mejor serie del día</div></div>' +
        '<div class="chips">' + sKeys.map(k => '<button type="button" class="chip' + (k === strengthEx ? ' on' : '') + '" data-sx="' + esc(k) + '">' + esc(exName(k)) + '</button>').join('') + '</div>' +
        lineChart(pts.map(p => ({ label: pdate(p.fecha).getDate() + '/' + (pdate(p.fecha).getMonth() + 1), value: p.valor })), 'kg') + '</section>';
    }
    html += '<section class="card"><div class="topbar"><h3>Peso</h3><button class="btn small soft" type="button" id="addw">Apuntar</button></div>' +
      ((stt.measures.peso || []).length > 1 ? lineChart(stt.measures.peso.map(p => ({ label: pdate(p.fecha).getDate() + '/' + (pdate(p.fecha).getMonth() + 1), value: p.valor })), 'kg') : '<div class="muted small">Apunta tu peso en ayunas una vez a la semana para ver la tendencia.</div>') + '</section>';
    html += '<section class="card"><div class="topbar"><h3>Objetivos</h3><button class="btn small soft" type="button" id="addg">Añadir</button></div>' +
      (st.goals.length ? st.goals.map(g => '<div class="goal"><div class="grow" style="flex:1"><div style="font-weight:600">🎯 ' + esc(g.titulo) + '</div><div class="small muted">' + esc([g.detalle, g.fecha ? 'para el ' + g.fecha.split('-').reverse().join('/') : ''].filter(Boolean).join(' · ')) + '</div></div><button class="btn small line" type="button" data-gd="' + esc(g.id) + '">Conseguido</button></div>').join('') : '<div class="muted">Sin objetivos activos.</div>') +
      '<p class="muted small" style="margin:0">También puedes decírselo al entrenador en el chat: "mi objetivo ahora es…".</p></section>';
    view.innerHTML = html;
    bindCharts(view);
    view.querySelectorAll('[data-sx]').forEach(b => b.onclick = () => { strengthEx = b.dataset.sx; viewProgress(); });
    view.querySelectorAll('[data-gd]').forEach(b => b.onclick = () => act('goal_done', { id: b.dataset.gd }, () => { LS.del('cache.state'); render(); }));
    $('#addw').onclick = () => sheet('<h2>Apuntar peso</h2><label class="field"><span class="label">Kg en ayunas</span><input id="v" inputmode="decimal" placeholder="70,0"></label><button class="btn accent" type="button" id="ok">Guardar</button>', p => {
      p.querySelector('#ok').onclick = () => { const v = parseFloat(p.querySelector('#v').value.replace(',', '.')); if (!v) return; closeSheet(); act('measure', { tipo: 'peso', valor: v, unidad: 'kg' }); };
    });
    $('#addg').onclick = () => sheet('<h2>Objetivo nuevo</h2><label class="field"><span class="label">Qué quieres conseguir</span><input id="t" placeholder="Bajar de 45 min en 10 km"></label><label class="field"><span class="label">Para cuándo (opcional)</span><input id="f" type="date"></label>' +
      '<label class="field"><span class="label">Prioridad</span><select id="p"><option value="1">Alta</option><option value="2" selected>Media</option><option value="3">Baja</option></select></label><button class="btn accent" type="button" id="ok">Guardar</button>', p => {
      p.querySelector('#ok').onclick = () => { const t = p.querySelector('#t').value.trim(); if (!t) return; closeSheet(); act('goal', { titulo: t, fecha: p.querySelector('#f').value, prioridad: p.querySelector('#p').value }, () => { LS.del('cache.state'); render(); }); };
    });
  }

  // gráficos: una sola serie, color de acento, rejilla discreta, tooltip al tocar y tabla para leer los valores
  const W = 340, H = 150, PL = 30, PB = 22, PT = 10;
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 2.5, 5, 10].map(m => m * p).find(m => m >= v); }
  const fmtN = v => String(Math.round(v * 10) / 10).replace('.', ',');
  function axes(max) {
    return [0, 0.5, 1].map(f => { const y = PT + (H - PT - PB) * (1 - f); return '<line x1="' + PL + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#ECE8E2" stroke-width="1"/><text x="' + (PL - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="#6B6660">' + fmtN(max * f) + '</text>'; }).join('');
  }
  function table(pts, unit) { return '<details class="table"><summary>Ver en tabla</summary><table><tr><th>Fecha</th><th>' + esc(unit) + '</th></tr>' + pts.map(p => '<tr><td>' + esc(p.label) + '</td><td>' + fmtN(p.value) + '</td></tr>').join('') + '</table></details>'; }
  function barChart(pts, unit) {
    const max = niceMax(Math.max.apply(null, pts.map(p => p.value).concat([0])));
    const n = pts.length, slot = (W - PL) / n, bw = Math.min(18, slot - 6);
    const bars = pts.map((p, i) => {
      const h = (H - PT - PB) * p.value / max, x = PL + slot * i + (slot - bw) / 2, y = H - PB - h;
      const r = Math.min(4, h);
      const d = h > 0 ? 'M' + x + ',' + (H - PB) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + bw - r) + 'Q' + (x + bw) + ',' + y + ' ' + (x + bw) + ',' + (y + r) + 'V' + (H - PB) + 'Z' : '';
      return '<g data-tip="' + esc(p.tip || fmtN(p.value) + ' ' + unit) + '" data-x="' + (x + bw / 2) + '" data-y="' + y + '" tabindex="0"><rect x="' + (PL + slot * i) + '" y="' + PT + '" width="' + slot + '" height="' + (H - PT) + '" fill="transparent"/>' + (d ? '<path d="' + d + '" fill="' + (i === n - 1 ? '#B83A0B' : '#D9794F') + '"/>' : '') +
        (i % 2 === (n - 1) % 2 ? '<text x="' + (x + bw / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="#6B6660">' + esc(p.label) + '</text>' : '') + '</g>';
    }).join('');
    const last = pts[n - 1];
    return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Gráfico de barras, última semana ' + esc(last ? fmtN(last.value) : 0) + ' ' + esc(unit) + '">' + axes(max) + '<line x1="' + PL + '" x2="' + W + '" y1="' + (H - PB) + '" y2="' + (H - PB) + '" stroke="#CFC8BF"/>' + bars + '</svg><div class="tip" hidden></div></div>' + table(pts, unit);
  }
  function lineChart(pts, unit) {
    const vals = pts.map(p => p.value), lo = Math.floor(Math.min.apply(null, vals) * 0.95), hiV = Math.max.apply(null, vals);
    const span = niceMax(Math.max(1, hiV - lo)), max = lo + span;
    const n = pts.length, X = i => PL + 8 + (W - PL - 16) * (n === 1 ? 0.5 : i / (n - 1)), Y = v => PT + (H - PT - PB) * (1 - (v - lo) / (max - lo));
    const grid = [0, 0.5, 1].map(f => { const y = PT + (H - PT - PB) * (1 - f); return '<line x1="' + PL + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#ECE8E2"/><text x="' + (PL - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="#6B6660">' + fmtN(lo + span * f) + '</text>'; }).join('');
    const path = pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(p.value).toFixed(1)).join('');
    const lastP = pts[n - 1];
    const hits = pts.map((p, i) => '<g data-tip="' + esc(fmtN(p.value) + ' ' + unit + ' · ' + p.label) + '" data-x="' + X(i) + '" data-y="' + Y(p.value) + '" tabindex="0"><rect x="' + (X(i) - (W - PL) / n / 2) + '" y="' + PT + '" width="' + ((W - PL) / n) + '" height="' + (H - PT) + '" fill="transparent"/></g>').join('');
    const labels = [0, n - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => '<text x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="' + (i ? 'end' : 'start') + '" font-size="10" fill="#6B6660">' + esc(pts[i].label) + '</text>').join('');
    return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Evolución, último valor ' + esc(fmtN(lastP.value)) + ' ' + esc(unit) + '">' + grid + '<path d="' + path + '" fill="none" stroke="#B83A0B" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + X(n - 1) + '" cy="' + Y(lastP.value) + '" r="4.5" fill="#B83A0B" stroke="#fff" stroke-width="2"/><text x="' + (X(n - 1) - 8) + '" y="' + (Y(lastP.value) - 9) + '" text-anchor="end" font-size="12" font-weight="700" fill="#1C1C1E">' + fmtN(lastP.value) + ' ' + esc(unit) + '</text>' + labels + hits + '<line class="cross" x1="0" x2="0" y1="' + PT + '" y2="' + (H - PB) + '" stroke="#6B6660" stroke-width="1" visibility="hidden"/></svg><div class="tip" hidden></div></div>' + table(pts, unit);
  }
  function bindCharts(root) {
    root.querySelectorAll('.chart').forEach(c => {
      const tip = c.querySelector('.tip'), svg = c.querySelector('svg'), cross = c.querySelector('.cross');
      const show = g => {
        const b = svg.getBoundingClientRect(), k = b.width / W;
        tip.textContent = g.dataset.tip; tip.hidden = false;
        tip.style.left = Math.min(b.width - 40, Math.max(40, g.dataset.x * k)) + 'px'; tip.style.top = (g.dataset.y * k) + 'px';
        if (cross) { cross.setAttribute('x1', g.dataset.x); cross.setAttribute('x2', g.dataset.x); cross.setAttribute('visibility', 'visible'); }
      };
      const hide = () => { tip.hidden = true; if (cross) cross.setAttribute('visibility', 'hidden'); };
      c.querySelectorAll('g[data-tip]').forEach(g => { g.addEventListener('pointerenter', () => show(g)); g.addEventListener('focus', () => show(g)); g.addEventListener('click', () => show(g)); g.addEventListener('blur', hide); });
      svg.addEventListener('pointerleave', hide);
    });
  }

  // ------------------------------------------------------------------ modo demostración (datos de ejemplo en el propio móvil)
  const Demo = (function () {
    const D = window.DEMO_DATA;
    let db = null;
    const undos = {};
    const KG = { sentadilla_goblet: 16, peso_muerto_rumano: 14, zancada_atras: 8, press_mancuernas: 12, jalon_pecho: 40, remo_mancuerna: 14, bulgara: 8, step_up: 8, peso_muerto_unilateral: 10, flexiones: '' };
    function init() {
      const t = today(), mon = mondayOf(t);
      const plan = [['FA', 0, '20:00'], ['CS', 1, '20:00'], ['FB', 2, '20:00'], ['FC', 4, '20:00'], ['BI', 5, '10:00'], ['CL', 6, '09:30']];
      const rows = plan.map(([k, off, hm], i) => {
        const s = D.sessions[k], fecha = addDays(mon, off), dur = s.minutos + (s.lugar === 'gym' ? 20 : 0);
        return { id: 'd' + i, semana: mon, clave: k, tipo: s.tipo, titulo: s.titulo, prioridad: s.prioridad, minutos: s.minutos, lugar: s.lugar, version: s.lugar === 'gym' ? 'gym' : s.lugar,
          fecha, inicio: hm, fin: addMin(hm, dur), estado: fecha < t ? 'hecha' : 'planificada', cierre: fecha < t ? { rpe: 6 + (i % 3), dolor: 0 } : {} };
      });
      // la última sesión pasada se queda sin cerrar, para enseñar el aviso
      const past = rows.filter(r => r.fecha < t);
      if (past.length) { past[past.length - 1].estado = 'planificada'; past[past.length - 1].cierre = {}; }
      // la de hoy (si no hay, se pone una para que se vea el modo gimnasio)
      if (!rows.some(r => r.fecha === t)) rows.push({ id: 'd9', semana: mon, clave: 'FB', tipo: 'fuerza', titulo: D.sessions.FB.titulo, prioridad: 'clave', minutos: 60, lugar: 'gym', version: 'gym', fecha: t, inicio: '20:00', fin: '21:20', estado: 'planificada', cierre: {} });
      db = { rows, modo: 'normal', series: [], goals: [
        { id: 'g1', titulo: 'Primer triatlón olímpico', detalle: 'Objetivo de ejemplo', fecha: '2027-06-15' },
        { id: 'g2', titulo: 'Ganar fuerza con buena técnica', detalle: 'Técnica primero, cargas moderadas', fecha: '' },
        { id: 'g3', titulo: 'Mejorar la postura', detalle: 'Fuerza de espalda y control escapular', fecha: '' }],
        questions: [{ id: 'q1', texto: 'Natación técnica no cabe esta semana sin tocar el estudio. ¿Qué hacemos?', opciones: ['Mantener estudio', 'Entrenar igual', 'Versión corta en casa'] }],
        chat: [{ rol: 'entrenador', texto: 'Esta semana toca la 2 del bloque: subimos un poco el volumen de fuerza y mantenemos la carrera suave. La fuerza mejora la economía de carrera [E3] y reduce lesiones [E1].', cites: ['E3', 'E1'].map(cite) }],
        peso: [75.6, 75.2, 75.4, 74.9, 75.0, 74.8].map((v, i) => ({ fecha: addDays(mon, -7 * (5 - i)), valor: v })),
        perfil: [{ clave: 'nombre', valor: 'Demo' }, { clave: 'deportes', valor: 'carrera, bici, natación' }, { clave: 'gustos', valor: 'prefiere lo dinámico' }], reloj: true };
    }
    function cite(id) { const e = D.evidence.find(x => x.id === id); return e && { id: e.id, afirmacion: e.afirmacion, autores: e.autores, año: e.año, revista: e.revista, doi: e.doi, titulo: e.titulo, tipo: e.tipo, solidez: e.solidez }; }
    const out = r => ({ id: r.id, clave: r.clave, tipo: r.tipo, titulo: r.titulo, fecha: r.fecha, inicio: r.inicio, fin: r.fin, prioridad: r.prioridad, minutos: r.minutos, lugar: r.lugar, version: r.version, estado: r.estado, cierre: r.cierre });
    function snap() { const id = 'u' + Date.now(); undos[id] = JSON.stringify(db); return id; }
    const freeDay = (from, r) => { for (let d = from; d <= addDays(r.semana, 6); d = addDays(d, 1)) if (!db.rows.some(x => x.fecha === d && x.estado !== 'no hecha' && x.estado !== 'cambiada')) return d; return null; };
    const live = ['planificada', 'reservar', 'hecha', 'a medias'];
    const handlers = {
      state() {
        const t = today(), mon = mondayOf(t), rows = db.rows.filter(r => r.semana === mon);
        const ring = tipos => { const p = rows.filter(r => tipos.indexOf(r.tipo) >= 0 && ['hecha', 'a medias', 'planificada', 'reservar', 'no hecha'].indexOf(r.estado) >= 0); return [p.filter(r => r.estado === 'hecha' || r.estado === 'a medias').length, p.length]; };
        const now = Date.now(), end = r => pdate(r.fecha).setHours(...r.fin.split(':').map(Number));
        return { hoy: t, today: rows.filter(r => r.fecha === t && live.indexOf(r.estado) >= 0).map(out),
          next: db.rows.filter(r => r.fecha > t && ['planificada', 'reservar'].indexOf(r.estado) >= 0).sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio)).slice(0, 4).map(out),
          week: rows.map(out), rings: { fuerza: ring(['fuerza']), cardio: ring(['carrera', 'bici', 'natacion']), deporte: [1, 1] }, streak: 3,
          toClose: db.rows.filter(r => ['planificada', 'reservar'].indexOf(r.estado) >= 0 && end(r) < now && end(r) > now - 3 * 864e5).map(out),
          questions: db.questions, goals: db.goals, modo: db.modo, bloque: D.semanaBloque };
      },
      week(b) {
        const mon = addDays(mondayOf(today()), 7 * (Number(b.offset) || 0)), events = [];
        for (let i = 0; i < 5; i++) { const d = addDays(mon, i); events.push({ titulo: 'Estudio · planificador', fecha: d, inicio: '09:00', fin: '14:00' }, { titulo: i === 2 ? 'Prácticas de laboratorio' : 'Estudio · planificador', fecha: d, inicio: '15:30', fin: '19:30' }); }
        events.push({ titulo: '🏄 Surf', fecha: addDays(mon, 5), inicio: '16:30', fin: '18:30' });
        return { monday: mon, sessions: db.rows.filter(r => r.semana === mon && ['planificada', 'reservar', 'hecha', 'a medias', 'no hecha', 'sin hueco'].indexOf(r.estado) >= 0).map(out), events, bloque: D.semanaBloque };
      },
      session(b) {
        const r = db.rows.find(x => x.id === b.id);
        if (!r) throw new Error('No encuentro esa sesión.');
        const s = D.sessions[r.clave], o = out(r);
        o.semanaBloque = D.semanaBloque;
        if (s.ejercicios) o.ejercicios = s.ejercicios.map(e => Object.assign({}, e, { sugerido: e.t === 'fuerza' ? (KG[e.id] ? { kg: KG[e.id] + 2, texto: 'La última vez te sobró: sube a ' + (KG[e.id] + 2) + ' kg (3 series a ' + KG[e.id] + ' kg).' } : { kg: '', texto: 'Primera vez: elige un peso con el que te sobren ' + e.rir + ' repeticiones.' }) : null,
          hechas: db.series.filter(x => x.sesion === r.id && x.ejercicio === e.id) }));
        else o.texto = s.texto;
        o.porque = { texto: D.why[r.clave].texto, cites: D.why[r.clave].cites.map(c => cite(c.id)) };
        return o;
      },
      log_set(b) { db.series = db.series.filter(x => !(x.sesion === b.sesion && x.ejercicio === b.ejercicio && x.serie === b.serie)).concat([b]); return { ok: true }; },
      close(b) { const u = snap(), r = db.rows.find(x => x.id === b.id); r.estado = b.estado; r.cierre = { rpe: b.rpe, dolor: b.dolor, nota: b.nota }; return { msg: (b.estado === 'hecha' ? '¡Hecha! ' : 'Apuntado. ') + (Number(b.dolor) >= 4 ? 'Con molestias de ' + b.dolor + '/10 bajo el impacto de la próxima sesión.' : ''), undo: u }; },
      cant(b) {
        const u = snap(), r = db.rows.find(x => x.id === b.id);
        r.estado = 'no hecha';
        const d = freeDay(addDays(today(), 1), r);
        if (!d) return { msg: 'Quitada: ' + r.titulo + '. No hay otro hueco libre esta semana.', undo: u };
        db.rows.push(Object.assign({}, r, { id: 'r' + Date.now(), fecha: d, estado: 'planificada' }));
        return { msg: 'Quitada: ' + r.titulo + '. La he pasado al ' + DIAS[dow(d)] + ' a las ' + r.inicio + '.', undo: u };
      },
      move(b) { const u = snap(), r = db.rows.find(x => x.id === b.id); r.fecha = b.date; if (b.time) { const dur = (r.fin.split(':')[0] * 60 + +r.fin.split(':')[1]) - (r.inicio.split(':')[0] * 60 + +r.inicio.split(':')[1]); r.inicio = b.time; r.fin = addMin(b.time, dur); } return { msg: r.titulo + ' pasa al ' + DIAS[dow(b.date)] + ' a las ' + r.inicio + '.', undo: u }; },
      swap_run(b) { const u = snap(), r = db.rows.find(x => x.id === b.id); r.estado = 'cambiada'; db.rows.push(Object.assign({}, r, { id: 'r' + Date.now(), clave: 'CS', tipo: 'carrera', titulo: D.sessions.CS.titulo, minutos: D.sessions.CS.minutos, lugar: 'calle', version: 'calle', estado: 'planificada', fin: addMin(r.inicio, D.sessions.CS.minutos) })); return { msg: 'Cambiada por carrera suave a las ' + r.inicio + '.', undo: u }; },
      mode(b) {
        const u = snap(), keep = { normal: null, corto: ['FA', 'FB', 'CS'], mantenimiento: ['FA', 'FB'] }[b.mode];
        db.modo = b.mode;
        db.rows.forEach(r => { if (keep && r.fecha >= today() && r.estado === 'planificada' && keep.indexOf(r.clave) < 0) r.estado = 'replanificada'; if (!keep && r.estado === 'replanificada') r.estado = 'planificada'; });
        return { msg: { normal: 'Semana normal.', corto: 'Semana con poco tiempo: lo esencial y en versión corta.', mantenimiento: 'Semana de mantenimiento: dos sesiones cortas.' }[b.mode], undo: u };
      },
      answer(b) { db.questions = db.questions.filter(q => q.id !== b.id); return { msg: ['Vale, el estudio manda. La semana que viene le doy prioridad.', 'Hecho: entrenas igual y aviso al planificador para que recoloque el estudio.', 'Hecho: versión corta en casa.'][Number(b.option)] }; },
      undo(b) { if (!undos[b.undo]) return { msg: 'Ya no se puede deshacer.' }; db = JSON.parse(undos[b.undo]); return { msg: 'Deshecho.' }; },
      chat_history() { return { messages: db.chat }; },
      chat(b) {
        const t = b.text.toLowerCase();
        let reply = 'En la demostración no hay IA conectada. Con tu agenda, el entrenador te contesta en segundos (Groq, y Gemini de respaldo) y solo cita estudios verificados, como [E1].';
        let cites = [cite('E1')];
        if (/molest|dolor|rodilla/.test(t)) { reply = 'Si molesta menos de 3/10 y al día siguiente está igual o mejor, puedes seguir con impacto suave; si no, cambiamos a bici o natación. Ese modelo de controlar el dolor funcionó en tendón de Aquiles [E10]; fuera del tendón es criterio propio. Trabajar glúteo y cadera ayuda [E17].'; cites = [cite('E10'), cite('E17')]; }
        else if (/justo|poco tiempo/.test(t)) { reply = 'Entendido. Pongo la semana en modo "poco tiempo": Fuerza A, Fuerza B y un rodaje, en versión corta.'; cites = []; handlers.mode({ mode: 'corto' }); }
        else if (/por qu/.test(t)) { reply = D.why.FA.texto; cites = D.why.FA.cites.map(c => cite(c.id)); }
        db.chat.push({ rol: 'yo', texto: b.text }, { rol: 'entrenador', texto: reply, cites });
        return { reply, cites };
      },
      evidence() { return { items: D.evidence }; },
      stats() {
        const mon = mondayOf(today()), weeks = [];
        for (let i = 11; i >= 0; i--) { const h = [3, 4, 4, 5, 2, 5, 5, 6, 4, 5, 6, 3][11 - i]; weeks.push({ semana: addDays(mon, -7 * i), hechas: h, planificadas: 6, carga: h * 380 + (i % 3) * 120, km_carrera: Math.round((14 + (11 - i) * 1.3 + (i % 2) * 3) * 10) / 10, km_bici: 30 }); }
        const prog = (base, step) => Array.from({ length: 8 }, (_, i) => ({ fecha: addDays(mon, -7 * (7 - i) - 3), valor: Math.round((base + step * i + (i % 3 === 1 ? -0.5 : 0)) * 10) / 10 }));
        return { weeks, strength: { sentadilla_goblet: prog(16.5, 1.1), peso_muerto_rumano: prog(15, 1.2), press_mancuernas: prog(12, 0.7), remo_mancuerna: prog(14, 0.8) }, measures: { peso: db.peso }, streak: 3 };
      },
      measure(b) { db.peso.push({ fecha: today(), valor: b.valor }); return { msg: 'Apuntado.' }; },
      goal(b) { db.goals.push({ id: 'g' + Date.now(), titulo: b.titulo, detalle: '', fecha: b.fecha }); return { msg: 'Objetivo apuntado.' }; },
      goal_done(b) { db.goals = db.goals.filter(g => g.id !== b.id); return { msg: '¡Conseguido!' }; },
      plan_now() { return { placed: 0, missing: [] }; },
      profile() { return { perfil: db.perfil, reloj: { conectado: db.reloj, atleta: db.reloj ? 'i000000' : '' } }; },
      save_profile(b) { b.items.forEach(it => { const p = db.perfil.find(x => x.clave === it.clave); if (p) p.valor = it.valor; else db.perfil.push(it); }); db.perfil = db.perfil.filter(x => b.borrar.indexOf(x.clave) < 0); return { msg: 'Perfil guardado.' }; },
      connect_watch(b) { db.reloj = !!(b.atleta || b.clave); return { msg: db.reloj ? 'Reloj conectado (demostración).' : 'Reloj desconectado.' }; },
      watch() {
        if (!db.reloj) return { conectado: false };
        const mon = mondayOf(today()), days = n => Array.from({ length: n }, (_, i) => addDays(today(), -7 * (n - 1 - i)));
        return { conectado: true, actualizado: Date.now() - 20 * 60000, vo2max: days(8).map((f, i) => ({ fecha: f, valor: 51 + Math.round(i * 0.3) })), reposo: days(8).map((f, i) => ({ fecha: f, valor: [52, 51, 52, 50, 50, 49, 50, 49][i] })),
          hrv: [], sueno: 7.3, forma: { ctl: 34, atl: 41 }, fcEntreno: 142, zonas: [310, 520, 140, 60, 25],
          semanas: Array.from({ length: 8 }, (_, i) => ({ semana: addDays(mon, -7 * (7 - i)), fc: [146, 144, 147, 141, 143, 140, 142, 139][i], horas: [3.1, 3.6, 2.4, 4, 3.8, 4.2, 3.5, 1.9][i] })), actividades: 23, ocultas: 0 };
      },
    };
    return {
      call(action, body) {
        if (!db) init();
        if (!handlers[action]) return Promise.reject(new Error('No disponible en la demostración.'));
        return new Promise((ok, ko) => setTimeout(() => { try { ok(JSON.parse(JSON.stringify(handlers[action](body)))); } catch (e) { ko(e); } }, action === 'chat' ? 700 : 120));
      },
    };
  })();

  // ------------------------------------------------------------------ arranque
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { /* sin caché sin conexión */ });
  if (!location.hash || location.hash === '#') history.replaceState(null, '', location.pathname + location.search + '#/inicio');
  render();
  // al volver a la app, datos frescos
  document.addEventListener('visibilitychange', () => { if (!document.hidden && /^#\/(inicio|calendario)?$/.test(location.hash)) render(); });
})();
