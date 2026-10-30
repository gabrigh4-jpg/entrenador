// Pruebas de la lógica pura del cerebro (reparto de la semana, prescripción, pesos, citas).
// Ejecutar: TZ=Europe/Madrid node tests/entreno.test.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const ctx = {
  console, Math, Date, JSON, String, Number, Object, Array, RegExp,
  // lo que da la agenda (Bot.gs / Tareas.gs), simplificado
  norm_: s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
  ymd_: d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); },
  hhmm_: d => { const x = new Date(d); return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); },
  HOUR: 3600000, DAY: 86400000,
};
vm.createContext(ctx);
// las const del archivo no quedan en el contexto: se exportan a mano
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Entreno.gs'), 'utf8') +
  '\n;Object.assign(this, { ENT, ENT_SESSIONS, ENT_MODES, ENT_WINDOWS, ENT_EVIDENCE });', ctx);
const T = (d, hm) => ctx.entAt_(d, hm);
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('✓ ' + name); };

// Semana del lunes 2 al domingo 8 de noviembre de 2026
const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
const now = T('2026-11-01', '18:00');
// estudio de 9 a 14 y de 15:30 a 20 de lunes a viernes, como el planificador
const study = [];
days.slice(0, 5).forEach(d => { study.push([T(d, '09:00'), T(d, '14:00')], [T(d, '15:30'), T(d, '20:00')]); });
const items = mode => ctx.ENT_MODES[mode].map(k => k === 'BI|NA' ? 'BI' : k).map(k => ({ key: k, lugar: ctx.ENT_SESSIONS[k].lugar, min: ctx.ENT_SESSIONS[k].min }));

test('coloca todas las sesiones de una semana normal sin pisar el estudio', () => {
  const r = ctx.layoutWeek_(items('normal'), { days, now, busy: study });
  assert.deepStrictEqual(Array.from(r.missing), []);
  assert.strictEqual(r.placed.length, 6);
  r.placed.forEach(p => assert.ok(!study.some(([a, b]) => a < p.end && b > p.start), p.key + ' pisa el estudio'));
});

test('el gimnasio entre semana va después del estudio y acaba antes del cierre (22:00 + vuelta)', () => {
  const r = ctx.layoutWeek_(items('normal'), { days, now, busy: study });
  r.placed.filter(p => ctx.ENT_SESSIONS[p.key].lugar === 'gym' && ctx.entDow_(p.date) >= 1 && ctx.entDow_(p.date) <= 5).forEach(p => {
    assert.ok(p.start >= T(p.date, '20:00'), p.key + ' empieza ' + ctx.entHm_(p.start));
    assert.ok(p.end <= T(p.date, '22:10'), p.key + ' acaba ' + ctx.entHm_(p.end));
  });
});

test('nunca pierna pesada el día antes de la tirada larga', () => {
  const r = ctx.layoutWeek_(items('normal'), { days, now, busy: study });
  const cl = r.placed.find(p => p.key === 'CL');
  const before = ctx.entAddDays_(cl.date, -1);
  assert.ok(!r.placed.some(p => (p.key === 'FA' || p.key === 'FC') && p.date === before));
});

test('nunca pierna pesada el día antes de un partido', () => {
  const r = ctx.layoutWeek_(items('normal'), { days, now, busy: study, fixedHard: { '2026-11-03': true } });
  assert.ok(!r.placed.some(p => (p.key === 'FA' || p.key === 'FC') && p.date === '2026-11-02'));
});

test('la bici no sale con lluvia, frío o de noche', () => {
  const weather = {};
  for (let h = 0; h < 24; h++) { const hh = String(h).padStart(2, '0'); weather['2026-11-07T' + hh] = { t: 14, p: 80 }; weather['2026-11-08T' + hh] = { t: 8, p: 0 }; }
  const light = {}; days.forEach(d => { light[d] = [T(d, '08:00'), T(d, '17:40')]; });
  const r = ctx.layoutWeek_([{ key: 'BI', lugar: 'bici', min: 75 }], { days, now, busy: study, weather, light });
  r.placed.forEach(p => {
    assert.ok(p.date !== '2026-11-07' && p.date !== '2026-11-08', 'bici el ' + p.date);
    assert.ok(p.end <= T(p.date, '17:25'));
  });
});

test('la natación solo en su horario y con 48 h de margen para reservar', () => {
  const r = ctx.layoutWeek_([{ key: 'NA', lugar: 'piscina', min: 40 }], { days, now: T('2026-11-02', '10:00'), busy: [] });
  const p = r.placed[0];
  assert.ok(p.start >= T('2026-11-02', '10:00') + 48 * 3600000);
  const dow = ctx.entDow_(p.date);
  assert.ok(dow === 0 ? p.start >= T(p.date, '15:00') : p.start >= T(p.date, '09:00') && p.end <= T(p.date, '13:00'));
});

test('si no hay ningún hueco, la sesión queda sin colocar en vez de pisar algo', () => {
  const full = days.map(d => [T(d, '00:00'), T(d, '23:59')]);
  const r = ctx.layoutWeek_(items('corto'), { days, now, busy: full });
  assert.strictEqual(r.placed.length, 0);
  assert.deepStrictEqual(Array.from(r.missing).sort(), ['CS', 'FA', 'FB']);
});

test('semana del bloque y descarga en la cuarta', () => {
  assert.deepStrictEqual(Object.assign({}, ctx.blockWeek_('2026-11-02', '2026-11-02')), { semana: 1, bloque: 1 });
  assert.deepStrictEqual(Object.assign({}, ctx.blockWeek_('2026-11-23', '2026-11-02')), { semana: 4, bloque: 1 });
  assert.deepStrictEqual(Object.assign({}, ctx.blockWeek_('2026-11-30', '2026-11-02')), { semana: 1, bloque: 2 });
  const w4 = ctx.prescribe_('FA', { semana: 4, bloque: 1 }, 'gym');
  const w1 = ctx.prescribe_('FA', { semana: 1, bloque: 1 }, 'gym');
  const sq = list => list.find(e => e.id === 'sentadilla_goblet');
  assert.ok(sq(w4).series < sq(w1).series && sq(w4).rir > sq(w1).rir);
  const contacts = list => list.filter(e => e.t === 'plio').reduce((a, e) => a + e.contactos, 0);
  assert.strictEqual(contacts(w1), 40);
  assert.ok(contacts(w4) < contacts(w1));
});

test('la pliometría va siempre la primera de la sesión', () => {
  ['FA', 'FB', 'FC'].forEach(k => ['gym', 'casa', 'corta'].forEach(v => {
    const list = ctx.prescribe_(k, { semana: 2, bloque: 1 }, v);
    const firstNonPlio = list.findIndex(e => e.t !== 'plio');
    assert.ok(!list.slice(firstNonPlio).some(e => e.t === 'plio'), k + ' ' + v);
  }));
});

test('doble progresión: sube solo si completaste las reps con el RIR pedido', () => {
  const target = { series: 3, reps: 8, rir: 2 };
  const day = '2026-11-02T19:00:00';
  const ok = [1, 2, 3].map(s => ({ ejercicio: 'sentadilla_goblet', fecha: day, kg: 16, reps: 8, rir: 2 }));
  assert.strictEqual(ctx.suggestKg_('sentadilla_goblet', target, ok).kg, 18);
  const short = ok.map((h, i) => Object.assign({}, h, { reps: i === 2 ? 6 : 8 }));
  assert.strictEqual(ctx.suggestKg_('sentadilla_goblet', target, short).kg, 16);
  assert.strictEqual(ctx.suggestKg_('press_mancuernas', target, ok).kg, '');
});

test('las citas inventadas se borran; las verificadas se quedan', () => {
  ctx.entRows_ = name => name === 'Evidencia' ? [{ id: 'E1', estado: 'verificado' }, { id: 'E3', estado: 'verificado' }, { id: 'E9', estado: 'pendiente: el DOI no existe' }] : [];
  const out = ctx.cleanCites_({ reply: 'La fuerza ayuda [E1] y la pliometría también (García et al., 2021). Según Smith (2019) y [E9], sí. Ver 10.1234/abc. Corre en Lisboa, 2026 está bien.', cites: ['E1', 'E7'] });
  assert.ok(out.reply.indexOf('[E1]') >= 0);
  assert.ok(!/García|Smith|E9|10\.1234/.test(out.reply), out.reply);
  assert.ok(/Lisboa, 2026/.test(out.reply), 'no debe borrar texto normal');
  assert.ok(/He quitado una referencia/.test(out.reply));
  assert.deepStrictEqual(Array.from(out.cites), ['E1']);
});

test('los minutos de carrera suben despacio y bajan en la descarga', () => {
  const cl = [1, 2, 3, 4].map(s => ctx.cardioMinutes_('CL', { semana: s, bloque: 1 }));
  assert.deepStrictEqual(Array.from(cl), [60, 65, 70, 45]);
  assert.strictEqual(ctx.cardioMinutes_('CL', { semana: 1, bloque: 2 }), 65);
});

console.log('\n' + n + ' pruebas correctas');
